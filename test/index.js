'use strict';
const Promise = require("bluebird");
var store = require('../index.js'),
  hasuraEndpointUrl = process.env.HASURA_GRAPHQL_API_ENDPOINT,
  // collection = 'test_node_cache_mongodb_1',
  assert = require('assert');

describe('node-cache-manager-hasura', function () {
  var s;

  before('connect', function (done) {
    s = store.create({
      uri: hasuraEndpointUrl,
      options: {
        secret: process.env.HASURA_GRAPHQL_ADMIN_SECRET,
        ttl: 0.1
      }
    });
    setTimeout(function () {
      done();
    }, 500);
  });

  after('cleanup', function () {
    s.reset();
    process.exit(0);
  });

  it('check expiry with 1s ttl', function () {
    this.timeout(30000);
    return s.set('test-cookie-1', 'test-user', {
      ttl: 2
    }).then(() => {
      return s.get('test-cookie-1');
    }).then((v) => {
      assert.strictEqual('test-user', v);
    }).delay(5000)
      .then(() => {
        return s.get('test-cookie-1')
      }).then((v) => {
        assert.ok(!v);
      });
  });

  it('check get', function () {
    this.timeout(5000);
    return s.set('test-cookie-3', 'test-user', {
      ttl: 10
    }).then(() => {
      return s.get('test-cookie-3');
    }).then((v) => {
      assert.strictEqual('test-user', v);
    });
  });

  it('check del', function () {
    this.timeout(5000);
    return s.set('test-cookie-4', 'test-user', {
      ttl: 10000
    }).then(() => {
      return s.del('test-cookie-4');
    }).then((v) => {
      assert.ok(v); // first delete should succeed
    }).then(() => {
      return s.get('test-cookie-4');
    }).then((v) => {
      assert.ok(!v); // second delete should fail
    })
  });


  it('check reset cache', function () {
    this.timeout(60000);
    return Promise.all([
      s.set('test-cookie-3', 'test-cookie-3', { ttl: 60000 }),
      s.set('test-cookie-2', 'test-cookie-2', { ttl: 60000 }),
      s.set('test-user', 'test-user', { ttl: 60000 })])
      .then(() => {
        return s.keys();
      }).then((keys) => {
        // we should have keys in cache before reset
        assert.ok(keys.length > 0);
      }).then(() => {
        return s.reset();
      }).then((reset) => {
        assert.ok(reset === true);
        return s.keys();
      }).then((keys) => {
        // make sure no keys in cache after reset
        assert.ok(keys.length === 0);
      })
  });

  it('check cache keys', function () {
    this.timeout(60000);
    return Promise.all([
      s.set('test-cookie-3', 'test-cookie-3', { ttl: 60000 }),
      s.set('test-cookie-2', 'test-cookie-2', { ttl: 60000 }),
      s.set('test-user', 'test-user', { ttl: 60000 })])
      .then(() => {
        return s.keys();
      }).then((res) => {
        assert.ok(res.length === 3);
      }).then(() => {
        return s.reset();
      })
  });
});
