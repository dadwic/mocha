'use strict';

const rewiremock = require('rewiremock/node');
const sinon = require('sinon');

describe('plugin module', function() {
  describe('PluginLoader', function() {
    let PluginLoader;
    beforeEach(function() {
      PluginLoader = rewiremock.proxy('../../lib/plugin', {}).PluginLoader;
    });

    describe('constructor', function() {
      it('should create an empty mapping of active plugins using defaults', function() {
        expect(new PluginLoader().pluginMap.get('mochaHooks'), 'to equal', []);
      });

      it('should accept an explicit list of plugin named exports', function() {
        expect(
          new PluginLoader({pluginNames: ['mochaBananaPhone']}).pluginMap.get(
            'mochaBananaPhone'
          ),
          'to equal',
          []
        );
      });

      it('should accept an explicit object of plugin validators', function() {
        const pluginValidators = {mochaBananaPhone: () => {}};
        expect(
          new PluginLoader({pluginValidators}).pluginValidators,
          'to be',
          pluginValidators
        );
      });
    });

    describe('static method', function() {
      describe('create()', function() {
        it('should return a PluginLoader instance', function() {
          expect(PluginLoader.create(), 'to be a', PluginLoader);
        });
      });
    });

    describe('instance method', function() {
      describe('load()', function() {
        let pluginLoader;

        beforeEach(function() {
          pluginLoader = PluginLoader.create();
        });
        describe('when called with a falsy value', function() {
          it('should return false', function() {
            expect(pluginLoader.load(), 'to be false');
          });
        });

        describe('when called with an object containing no recognized plugin', function() {
          it('should return false', function() {
            expect(
              pluginLoader.load({mochaBananaPhone: () => {}}),
              'to be false'
            );
          });
        });

        describe('when called with an object containing a recognized plugin', function() {
          let pluginLoader;
          let pluginValidators;
          beforeEach(function() {
            pluginValidators = {mochaBananaPhone: sinon.spy()};
            pluginLoader = PluginLoader.create({
              pluginNames: ['mochaBananaPhone'],
              pluginValidators
            });
          });

          it('should return true', function() {
            const func = () => {};
            expect(pluginLoader.load({mochaBananaPhone: func}), 'to be true');
          });

          it('should retain the value of any matching property in its mapping', function() {
            const func = () => {};
            pluginLoader.load({mochaBananaPhone: func});
            expect(pluginLoader.pluginMap.get('mochaBananaPhone'), 'to equal', [
              func
            ]);
          });

          it('should call the associated validator, if present', function() {
            const func = () => {};
            pluginLoader.load({mochaBananaPhone: func});
            expect(pluginValidators.mochaBananaPhone, 'was called once');
          });
        });
      });
    });
  });

  describe('aggregateRootHooks()', function() {
    let aggregateRootHooks;
    beforeEach(function() {
      aggregateRootHooks = rewiremock.proxy('../../lib/plugin', {})
        .aggregateRootHooks;
    });

    describe('when passed nothing', function() {
      it('should not reject', async function() {
        return expect(aggregateRootHooks(), 'to be fulfilled');
      });
    });

    describe('when passed empty array of hooks', function() {
      it('should return an empty MochaRootHooks object', async function() {
        return expect(aggregateRootHooks([]), 'to be fulfilled with', {
          beforeAll: [],
          beforeEach: [],
          afterAll: [],
          afterEach: []
        });
      });
    });

    describe('when passed an array containing hook objects and sync functions and async functions', function() {
      it('should flatten them into a single object', async function() {
        function a() {}
        function b() {}
        function d() {}
        function g() {}
        async function f() {}
        function c() {
          return {
            beforeAll: d,
            beforeEach: g
          };
        }
        async function e() {
          return {
            afterEach: f
          };
        }
        return expect(
          aggregateRootHooks([
            {
              beforeEach: a
            },
            {
              afterAll: b
            },
            c,
            e
          ]),
          'to be fulfilled with',
          {
            beforeAll: [d],
            beforeEach: [a, g],
            afterAll: [b],
            afterEach: [f]
          }
        );
      });
    });
  });
});
