'use strict';

const fs = require('fs-extra');
var format = require('util').format;
var spawn = require('cross-spawn').spawn;
var path = require('path');
var Base = require('../../lib/reporters/base');
var debug = require('debug')('mocha:tests:integration:helpers');
var DEFAULT_FIXTURE = resolveFixturePath('__default__');
var MOCHA_EXECUTABLE = require.resolve('../../bin/mocha');
var _MOCHA_EXECUTABLE = require.resolve('../../bin/_mocha');

module.exports = {
  DEFAULT_FIXTURE: DEFAULT_FIXTURE,

  /**
   * regular expression used for splitting lines based on new line / dot symbol.
   */
  splitRegExp: new RegExp('[\\n' + Base.symbols.dot + ']+'),

  /**
   * Invokes the mocha binary. Accepts an array of additional command line args
   * to pass. The callback is invoked with the exit code and output. Optional
   * current working directory as final parameter.
   *
   * By default, `STDERR` is ignored. Pass `{stdio: 'pipe'}` as `opts` if you
   * want it.
   *
   * In most cases runMocha should be used instead.
   *
   * Example response:
   * {
   *   code:    1,
   *   output:  '...'
   * }
   *
   * @param {Array<string>} args - Extra args to mocha executable
   * @param {Function} done - Callback
   * @param {Object} [opts] - Options for `spawn()`
   */
  invokeMocha: invokeMocha,

  invokeMochaAsync: invokeMochaAsync,

  invokeNode: invokeNode,

  getSummary: getSummary,

  /**
   * Resolves the path to a fixture to the full path.
   */
  resolveFixturePath: resolveFixturePath,

  toJSONRunResult: toJSONRunResult,

  /**
   * Given a regexp-like string, escape it so it can be used with the `RegExp` constructor
   * @param {string} str - string to be escaped
   * @returns {string} Escaped string
   */
  escapeRegExp: function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  },

  runMocha,
  runMochaJSON,
  runMochaAsync,
  runMochaJSONAsync,
  runMochaWatch,
  runMochaWatchJSON,
  copyFixture,
  touchFile,
  replaceFileContents
};

/**
 * Invokes the mocha binary for the given fixture with color output disabled.
 * Accepts an array of additional command line args to pass. The callback is
 * invoked with a summary of the run, in addition to its output. The summary
 * includes the number of passing, pending, and failing tests, as well as the
 * exit code. Useful for testing different reporters.
 *
 * By default, `STDERR` is ignored. Pass `{stdio: 'pipe'}` as `opts` if you
 * want it.
 * Example response:
 * {
 *   pending: 0,
 *   passing: 0,
 *   failing: 1,
 *   code:    1,
 *   output:  '...'
 * }
 *
 * @param {string} fixturePath - Path to fixture .js file
 * @param {string[]} args - Extra args to mocha executable
 * @param {Function} fn - Callback
 * @param {Object} [opts] - Options for `spawn()`
 * @returns {ChildProcess} Mocha process
 */
function runMocha(fixturePath, args, fn, opts) {
  if (typeof args === 'function') {
    opts = fn;
    fn = args;
    args = [];
  }

  var path;

  path = resolveFixturePath(fixturePath);
  args = args || [];

  return invokeSubMocha(
    args.concat(path),
    function(err, res) {
      if (err) {
        return fn(err);
      }

      fn(null, getSummary(res));
    },
    opts
  );
}

/**
 * Invokes the mocha binary for the given fixture using the JSON reporter,
 * returning the parsed output, as well as exit code.
 *
 * By default, `STDERR` is ignored. Pass `{stdio: 'pipe'}` as `opts` if you
 * want it.
 * @param {string} fixturePath - Path from __dirname__
 * @param {string[]} args - Array of args
 * @param {Function} fn - Callback
 * @param {Object} [opts] - Opts for `spawn()`
 * @returns {*} Parsed object
 */
function runMochaJSON(fixturePath, args, fn, opts) {
  if (typeof args === 'function') {
    opts = fn;
    fn = args;
    args = [];
  }

  var path;

  path = resolveFixturePath(fixturePath);
  args = (args || []).concat('--reporter', 'json', path);

  return invokeMocha(
    args,
    function(err, res) {
      if (err) {
        return fn(err);
      }

      var result;
      try {
        // attempt to catch a JSON parsing error *only* here.
        // previously, the callback was called within this `try` block,
        // which would result in errors thrown from the callback
        // getting caught by the `catch` block below.
        result = toJSONRunResult(res);
      } catch (err) {
        return fn(
          new Error(
            format(
              'Failed to parse JSON reporter output. Error:\n%O\nResult:\n%O',
              err,
              res
            )
          )
        );
      }
      fn(null, result);
    },
    opts
  );
}

/**
 *
 * If you need more granular control, try {@link invokeMochaAsync} instead.
 *
 * Like {@link runMocha}, but returns a `Promise`.
 * @param {string} fixturePath - Path to (or name of, or basename of) fixture file
 * @param {Options} [args] - Command-line arguments to the `mocha` executable
 * @param {Object} [opts] - Options for `child_process.spawn`.
 * @returns {Promise<Summary>}
 */
function runMochaAsync(fixturePath, args, opts) {
  return new Promise(function(resolve, reject) {
    runMocha(
      fixturePath,
      args,
      function(err, result) {
        if (err) {
          return reject(err);
        }
        resolve(result);
      },
      opts
    );
  });
}

/**
 * Like {@link runMochaJSON}, but returns a `Promise`.
 * @param {string} fixturePath - Path to (or name of, or basename of) fixture file
 * @param {Options} [args] - Command-line args
 * @param {Object} [opts] - Options for `child_process.spawn`
 */
function runMochaJSONAsync(fixturePath, args, opts) {
  return new Promise(function(resolve, reject) {
    runMochaJSON(
      fixturePath,
      args,
      function(err, result) {
        if (err) {
          return reject(err);
        }
        resolve(result);
      },
      opts
    );
  });
}

/**
 * Coerce output as returned by _spawnMochaWithListeners using JSON reporter into a JSONRunResult as
 * recognized by our custom unexpected assertions
 * @param {string} result - Raw stdout from Mocha run using JSON reporter
 * @private
 */
function toJSONRunResult(result) {
  var code = result.code;
  try {
    result = JSON.parse(result.output);
    result.code = code;
    return result;
  } catch (err) {
    throw new Error(
      `Couldn't parse JSON: ${err.message}\n\nOriginal result output: ${result.output}`
    );
  }
}

/**
 * Creates arguments loading a default fixture if none provided
 *
 * - The `--no-color` arg is always used (color output complicates testing `STDOUT`)
 * - Unless `--bail` or `--no-bail` is set, use `--no-bail`.  This enables using
 *   `--bail` (if desired) from the command-line when running our integration
 *   test suites without stepping on the toes of subprocesses.
 * - Unless `--parallel` or `--no-parallel` is set, use `--no-parallel`.  We
 *   assume the test suite is _already_ running in parallel--and there's no point
 *   in trying to run a single test fixture in parallel.
 * - The {@link DEFAULT_FIXTURE} file is used if no arguments are provided.
 *
 * @param {string[]|*} [args] - Arguments to `spawn`
 * @returns string[]
 */
function defaultArgs(args) {
  var newArgs = (!args || !args.length ? [DEFAULT_FIXTURE] : args).concat([
    '--no-color'
  ]);
  if (!newArgs.some(arg => /--(no-)?bail/.test(arg))) {
    newArgs.push('--no-bail');
  }
  if (!newArgs.some(arg => /--(no-)?parallel/.test(arg))) {
    newArgs.push('--no-parallel');
  }
  return newArgs;
}

function invokeMocha(args, fn, opts) {
  if (typeof args === 'function') {
    opts = fn;
    fn = args;
    args = [];
  }
  return _spawnMochaWithListeners(
    defaultArgs([MOCHA_EXECUTABLE].concat(args)),
    fn,
    opts
  );
}

/**
 * Invokes the mocha binary with the given arguments. Returns the
 * child process and a promise for the results of running the
 * command. The promise resolves when the child process exits. The
 * result includes the **raw** string output, as well as exit code.
 *
 * By default, `STDERR` is ignored. Pass `{stdio: 'pipe'}` as `opts` if you
 * want it as part of the result output.
 *
 * @param {string[]} args - Array of args
 * @param {Object} [opts] - Opts for `spawn()`
 * @returns {[ChildProcess|Promise<Result>]}
 */
function invokeMochaAsync(args, opts) {
  let mochaProcess;
  const resultPromise = new Promise((resolve, reject) => {
    mochaProcess = _spawnMochaWithListeners(
      defaultArgs([MOCHA_EXECUTABLE].concat(args)),
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      },
      opts
    );
  });
  return [mochaProcess, resultPromise];
}

/**
 * Invokes Node without Mocha binary with the given arguments,
 * when Mocha is used programmatically.
 */
function invokeNode(args, fn, opts) {
  if (typeof args === 'function') {
    opts = fn;
    fn = args;
    args = [];
  }
  return _spawnMochaWithListeners(args, fn, opts);
}

function invokeSubMocha(args, fn, opts) {
  if (typeof args === 'function') {
    opts = fn;
    fn = args;
    args = [];
  }
  return _spawnMochaWithListeners(
    defaultArgs([_MOCHA_EXECUTABLE].concat(args)),
    fn,
    opts
  );
}

/**
 * Spawns Mocha in a subprocess and returns an object containing its output and exit code
 *
 * @param {string[]} args - Path to executable and arguments
 * @param {Function} fn - Callback
 * @param {Object|string} [opts] - Options to `cross-spawn`, or 'pipe' for shortcut to `{stdio: pipe}`
 * @returns {ChildProcess}
 * @private
 */
function _spawnMochaWithListeners(args, fn, opts) {
  var output = '';
  opts = opts || {};
  if (opts === 'pipe') {
    opts = {stdio: ['inherit', 'pipe', 'pipe']};
  }
  var env = Object.assign({}, process.env);
  // prevent DEBUG from borking STDERR when piping, unless explicitly set via `opts`
  delete env.DEBUG;

  opts = Object.assign(
    {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'inherit'],
      env: env
    },
    opts
  );

  debug('spawning: %s', [process.execPath].concat(args).join(' '));
  var mocha = spawn(process.execPath, args, opts);
  var listener = function(data) {
    output += data;
  };

  mocha.stdout.on('data', listener);
  if (mocha.stderr) {
    mocha.stderr.on('data', listener);
  }
  mocha.on('error', fn);

  mocha.on('close', function(code) {
    fn(null, {
      output: output,
      code: code,
      args: args,
      command: args.join(' ')
    });
  });

  return mocha;
}

function resolveFixturePath(fixture) {
  if (path.extname(fixture) !== '.js' && path.extname(fixture) !== '.mjs') {
    fixture += '.fixture.js';
  }
  return path.isAbsolute(fixture)
    ? fixture
    : path.join('test', 'integration', 'fixtures', fixture);
}

/**
 * Parses some `mocha` reporter output and returns a summary based on the "epilogue"
 * @param {string} res - Typically output of STDOUT from the 'spec' reporter
 * @returns {Summary}
 */
function getSummary(res) {
  return ['passing', 'pending', 'failing'].reduce(function(summary, type) {
    var pattern, match;

    pattern = new RegExp('  (\\d+) ' + type + '\\s');
    match = pattern.exec(res.output);
    summary[type] = match ? parseInt(match, 10) : 0;

    return summary;
  }, res);
}

/**
 * Runs the mocha binary in watch mode calls `change` and returns the
 * raw result.
 *
 * The function starts mocha with the given arguments and `--watch` and
 * waits until the first test run has completed. Then it calls `change`
 * and waits until the second test run has been completed. Mocha is
 * killed and the result is returned.
 *
 * **Exit code will always be 0**
 */
async function runMochaWatch(args, cwd, change) {
  const [mochaProcess, resultPromise] = invokeMochaAsync([...args, '--watch'], {
    cwd,
    stdio: ['pipe', 'pipe', 'inherit']
  });
  await sleep(2000);
  await change(mochaProcess);
  await sleep(2000);
  mochaProcess.kill('SIGINT');
  const res = await resultPromise;
  // we kill the process with sigint, so it will always appear as "failed" to our
  // custom assertions (a non-zero exit code 130). just change it to 0.
  res.code = 0;
  return res;
}

/**
 * Runs the mocha binary in watch mode calls `change` and returns the
 * JSON reporter output.
 *
 * The function starts mocha with the given arguments and `--watch` and
 * waits until the first test run has completed. Then it calls `change`
 * and waits until the second test run has been completed. Mocha is
 * killed and the list of JSON outputs is returned.
 */
async function runMochaWatchJSON(args, cwd, change) {
  const res = await runMochaWatch([...args, '--reporter', 'json'], cwd, change);
  return (
    res.output
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b\[\?25./g, '')
      .split('\u001b[2K')
      .map(x => JSON.parse(x))
  );
}

/**
 * Synchronously touch a file by appending a space to the end. Creates
 * the file and all its parent directories if necessary.
 */
function touchFile(file) {
  fs.ensureDirSync(path.dirname(file));
  fs.appendFileSync(file, ' ');
}

/**
 * Synchronously replace all substrings matched by `pattern` with
 * `replacement` in the file’s content.
 */
function replaceFileContents(file, pattern, replacement) {
  const contents = fs.readFileSync(file, 'utf-8');
  const newContents = contents.replace(pattern, replacement);
  fs.writeFileSync(file, newContents, 'utf-8');
}

/**
 * Synchronously copy a fixture to the given destination file path.
 * Creates parent directories of the destination path if necessary.
 */
function copyFixture(fixtureName, dest) {
  const fixtureSource = resolveFixturePath(fixtureName);
  fs.ensureDirSync(path.dirname(dest));
  fs.copySync(fixtureSource, dest);
}

/**
 * Waits for `time` ms.
 * @param {number} time - Time in ms
 * @returns {Promise<void>}
 */
function sleep(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

/**
 * A summary of a `mocha` run
 * @typedef {Object} Summary
 * @property {number} passing - Number of passing tests
 * @property {number} pending - Number of pending tests
 * @property {number} failing - Number of failing tests
 */
