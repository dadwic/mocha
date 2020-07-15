'use strict';

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const {
  touchFile,
  runMochaAsync,
  runMochaWatch,
  copyFixture
} = require('../helpers');

describe('global setup/teardown', function() {
  describe('when mocha run in serial mode', function() {
    it('should execute global setup and teardown', async function() {
      return expect(
        runMochaAsync('__default__', [
          '--require',
          require.resolve(
            '../fixtures/plugins/global-setup-teardown/global-setup-teardown.fixture.js'
          )
        ]),
        'when fulfilled',
        'to have passed'
      );
    });

    it('should share context', async function() {
      return expect(
        runMochaAsync('__default__', [
          '--require',
          require.resolve(
            '../fixtures/plugins/global-setup-teardown/global-setup-teardown.fixture.js'
          )
        ]),
        'when fulfilled',
        'to contain',
        /setup: this\.foo = bar[\s\S]+teardown: this\.foo = bar/
      );
    });

    describe('when supplied multiple functions', function() {
      it('should execute them sequentially', async function() {
        return expect(
          runMochaAsync('__default__', [
            '--require',
            require.resolve(
              '../fixtures/plugins/global-setup-teardown/global-setup-teardown-multiple.fixture.js'
            )
          ]),
          'when fulfilled',
          'to contain',
          /teardown: this.foo = 3/
        );
      });
    });

    describe('when run in watch mode', function() {
      let tempDir;
      let testFile;

      beforeEach(async function() {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mocha-'));
        testFile = path.join(tempDir, 'test.js');
        copyFixture('__default__', testFile);
      });

      afterEach(async function() {
        if (tempDir) {
          return fs.remove(tempDir);
        }
      });

      it('should execute global setup and teardown', async function() {
        return expect(
          runMochaWatch(
            [
              '--require',
              require.resolve(
                '../fixtures/plugins/global-setup-teardown/global-setup-teardown.fixture.js'
              ),
              testFile
            ],
            tempDir,
            () => {
              touchFile(testFile);
            }
          ),
          'when fulfilled',
          'to have passed'
        );
      });

      it('should not re-execute the global fixtures', async function() {
        return expect(
          runMochaWatch(
            [
              '--require',
              require.resolve(
                '../fixtures/plugins/global-setup-teardown/global-setup-teardown-multiple.fixture.js'
              ),
              testFile
            ],
            tempDir,
            () => {
              touchFile(testFile);
            }
          ),
          'when fulfilled',
          'to contain once',
          /teardown: this.foo = 3/
        );
      });
    });
  });

  describe('when mocha run in parallel mode', function() {
    it('should execute global setup and teardown', async function() {
      return expect(
        runMochaAsync('__default__', [
          '--parallel',
          '--require',
          require.resolve(
            '../fixtures/plugins/global-setup-teardown/global-setup-teardown.fixture.js'
          )
        ]),
        'when fulfilled',
        'to have passed'
      );
    });

    it('should share context', async function() {
      return expect(
        runMochaAsync('__default__', [
          '--parallel',
          '--require',
          require.resolve(
            '../fixtures/plugins/global-setup-teardown/global-setup-teardown.fixture.js'
          )
        ]),
        'when fulfilled',
        'to contain',
        /setup: this.foo = bar/
      ).and('when fulfilled', 'to contain', /teardown: this.foo = bar/);
    });

    describe('when supplied multiple functions', function() {
      it('should execute them sequentially', async function() {
        return expect(
          runMochaAsync('__default__', [
            '--parallel',
            '--require',
            require.resolve(
              '../fixtures/plugins/global-setup-teardown/global-setup-teardown-multiple.fixture.js'
            )
          ]),
          'when fulfilled',
          'to contain',
          /teardown: this.foo = 3/
        );
      });
    });

    describe('when run in watch mode', function() {
      let tempDir;
      let testFile;

      beforeEach(async function() {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mocha-'));
        testFile = path.join(tempDir, 'test.js');
        copyFixture('__default__', testFile);
      });

      afterEach(async function() {
        if (tempDir) {
          return fs.remove(tempDir);
        }
      });

      it('should execute global setup and teardown', async function() {
        return expect(
          runMochaWatch(
            [
              '--parallel',
              '--require',
              require.resolve(
                '../fixtures/plugins/global-setup-teardown/global-setup-teardown.fixture.js'
              ),
              testFile
            ],
            tempDir,
            () => {
              touchFile(testFile);
            }
          ),
          'when fulfilled',
          'to have passed'
        );
      });

      it('should not re-execute the global fixtures', async function() {
        return expect(
          runMochaWatch(
            [
              '--parallel',
              '--require',
              require.resolve(
                '../fixtures/plugins/global-setup-teardown/global-setup-teardown-multiple.fixture.js'
              ),
              testFile
            ],
            tempDir,
            () => {
              touchFile(testFile);
            }
          ),
          'when fulfilled',
          'to contain once',
          /teardown: this.foo = 3/
        );
      });
    });
  });
});
