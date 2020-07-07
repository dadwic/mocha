'use strict';

const {createUnsupportedError} = require('./errors');
const {defineConstants, castArray} = require('./utils');

const constants = (exports.constants = defineConstants({
  PLUGIN_ROOT_HOOKS: 'mochaHooks',
  PLUGIN_GLOBAL_SETUP: 'mochaGlobalSetup',
  PLUGIN_GLOBAL_TEARDOWN: 'mochaGlobalTeardown'
}));
const {
  PLUGIN_ROOT_HOOKS,
  PLUGIN_GLOBAL_SETUP,
  PLUGIN_GLOBAL_TEARDOWN
} = constants;
const PLUGIN_NAMES = new Set(Object.values(constants));

exports.PluginLoader = class PluginLoader {
  constructor({
    pluginNames = PLUGIN_NAMES,
    pluginValidators = PluginValidators
  } = {}) {
    this.pluginNames = Array.from(pluginNames);
    this.pluginMap = new Map(
      this.pluginNames.map(pluginName => [pluginName, []])
    );
    this.pluginValidators = pluginValidators;
  }

  load(requiredModule) {
    // we should explicitly NOT fail if other stuff is exported.
    // we only care about the plugins we know about.
    if (requiredModule && typeof requiredModule === 'object') {
      return this.pluginNames.reduce((isFound, pluginName) => {
        const plugin = requiredModule[pluginName];
        if (plugin) {
          if (this.pluginValidators[pluginName]) {
            this.pluginValidators[pluginName](plugin);
          }
          this.pluginMap.set(pluginName, [
            ...this.pluginMap.get(pluginName),
            ...castArray(plugin)
          ]);
          return true;
        }
        return isFound;
      }, false);
    }
    return false;
  }

  async finalize() {
    const mochaHooks = this.pluginMap.get(PLUGIN_ROOT_HOOKS);
    const finalizedPlugins = Object.create(null);
    if (mochaHooks.length) {
      finalizedPlugins.rootHooks = await aggregateRootHooks(mochaHooks);
    }

    const mochaGlobalSetup = this.pluginMap.get(PLUGIN_GLOBAL_SETUP);
    if (mochaGlobalSetup.length) {
      finalizedPlugins.globalSetup = mochaGlobalSetup;
    }

    const mochaGlobalTeardown = this.pluginMap.get(PLUGIN_GLOBAL_TEARDOWN);
    if (mochaGlobalTeardown.length) {
      finalizedPlugins.globalTeardown = mochaGlobalTeardown;
    }

    return finalizedPlugins;
  }

  static create(...args) {
    return new PluginLoader(...args);
  }
};

const createFunctionArrayValidator = pluginType => value => {
  let isValid = true;
  if (Array.isArray(value)) {
    if (value.some(item => typeof item !== 'function')) {
      isValid = false;
    }
  } else if (typeof value !== 'function') {
    isValid = false;
  }
  if (!isValid) {
    throw createUnsupportedError(
      `${pluginType} must be a function or an array of functions`
    );
  }
};

const PluginValidators = {
  [PLUGIN_ROOT_HOOKS]: value => {
    if (
      Array.isArray(value) ||
      (typeof value !== 'function' && typeof value !== 'object')
    ) {
      throw createUnsupportedError(
        `${PLUGIN_ROOT_HOOKS} must be an object or a function returning (or fulfilling with) an object`
      );
    }
  },
  [PLUGIN_GLOBAL_SETUP]: createFunctionArrayValidator(PLUGIN_GLOBAL_SETUP),
  [PLUGIN_GLOBAL_TEARDOWN]: createFunctionArrayValidator(PLUGIN_GLOBAL_TEARDOWN)
};

/**
 * Loads root hooks as exported via `mochaHooks` from required files.
 * These can be sync/async functions returning objects, or just objects.
 * Flattens to a single object.
 * @param {MochaRootHookObject[]|MochaRootHookFunction[]} rootHooks - Array of root hooks
 * @private
 * @returns {MochaRootHookObject}
 */
const aggregateRootHooks = (exports.aggregateRootHooks = async (
  rootHooks = []
) => {
  const rootHookObjects = await Promise.all(
    rootHooks.map(async hook => (typeof hook === 'function' ? hook() : hook))
  );

  console.dir(rootHookObjects);
  return rootHookObjects.reduce(
    (acc, hook) => {
      hook = {
        beforeAll: [],
        beforeEach: [],
        afterAll: [],
        afterEach: [],
        ...hook
      };
      return {
        beforeAll: [...acc.beforeAll, ...castArray(hook.beforeAll)],
        beforeEach: [...acc.beforeEach, ...castArray(hook.beforeEach)],
        afterAll: [...acc.afterAll, ...castArray(hook.afterAll)],
        afterEach: [...acc.afterEach, ...castArray(hook.afterEach)]
      };
    },
    {beforeAll: [], beforeEach: [], afterAll: [], afterEach: []}
  );
});
