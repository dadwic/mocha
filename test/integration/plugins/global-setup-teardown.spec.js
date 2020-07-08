'use strict';

const {runMochaAsync} = require('../helpers');

describe('global setup', function() {
  describe('in serial mode', function() {
    it('should execute global setup and teardown', async function() {
      return expect(
        runMochaAsync('__default__', [
          '--require',
          require.resolve(
            '../fixtures/plugins/global-setup-teardown.fixture.js'
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
            '../fixtures/plugins/global-setup-teardown.fixture.js'
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
            '--require',
            require.resolve(
              '../fixtures/plugins/global-setup-teardown-multiple.fixture.js'
            )
          ]),
          'when fulfilled',
          'to contain',
          /teardown: this.foo = 3/
        );
      });
    });
  });

  describe('when running in parallel mode', function() {
    it('should execute global setup and teardown', async function() {
      return expect(
        runMochaAsync('__default__', [
          '--parallel',
          '--require',
          require.resolve(
            '../fixtures/plugins/global-setup-teardown.fixture.js'
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
            '../fixtures/plugins/global-setup-teardown.fixture.js'
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
              '../fixtures/plugins/global-setup-teardown-multiple.fixture.js'
            )
          ]),
          'when fulfilled',
          'to contain',
          /teardown: this.foo = 3/
        );
      });
    });
  });
});
