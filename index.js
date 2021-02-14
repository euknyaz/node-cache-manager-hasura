'use strict';

/**
 * Module dependencies.
 */
const fetch = require('node-fetch')
Promise = require('bluebird');

/**
 * HasuraStore constructor.
 *
 * @param {Object} options
 * @api public
 */

class HasuraStore {

  constructor(args) {
    var store = this;
    store.uri = (args.uri) ? args.uri : 'http://localhost:3001/v1/graphql';
    store.options = (args.options) ? args.options : {};
    store.options.ttl = (store.options.ttl) ? store.options.ttl : 60 * 1000;
    store.options.promiseLibrary = Promise;
    store.name = 'hasura';
    store.coll = 'cache';
    store.expireKey = 'expiresAt';
    store.compression = store.options.compression || false;
    return this;
  }

  /**
   * Hasura Query via GraphQL endpoint - internal function
   *
   * @param {String} query
   * @param {Object} variables
   * @param {Object} headers
   */
  hasuraQuery(query, variables, headers={}) {
    var store = this;
    const fetchPromise = fetch(store.uri, {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
      headers: { headers, ...{ 'x-hasura-admin-secret': store.options.secret}},
    }).then((data) => {
      return data.json()
    }).catch(err => {
      return Promise.reject(err)
    })
    return fetchPromise
  }

  /**
   * Compress data value.
   *
   * @param {Object} data
   * @api public
   */
  compress(data) {
    return new Promise((resolve, reject) => {
      // Data is not of a "compressable" type (currently only Buffer)
      if (!Buffer.isBuffer(data)) {
        return reject(new Error('Data is not of a "compressable" type (currently only Buffer)'));
      }
      zlib.gzip(data, (err, val) => {
        if (err)
          return reject(err);
        return resolve(val);
      });
    });
  }

  /**
   * Decompress data value.
   *
   * @param {Object} value
   * @api public
   */
  decompress(value) {
    return new Promise((resolve, reject) => {
      value = (value.buffer && Buffer.isBuffer(value.buffer)) ? value.buffer : value;
      zlib.gunzip(value, (err, data) => {
        if (err)
          return reject(err);
        return resolve(data);
      });
    });
  }


  /**
   * Get an entry.
   *
   * @param {String} key
   * @param {} options
   * @param {fn} cb
   * @api public
   */

  get(key, options, cb) {
    var store = this;

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.get(key, options, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }

    store.hasuraQuery(`
      query cacheGet($key: String!, $currentTimestamp: timestamptz) {
        cache(where: { 
          key: { _eq: $key },
          expiresAt: { _gte: $currentTimestamp }
        }) {
          value
          compressed
          expiresAt
        }
      }
    `, 
    { key, currentTimestamp: new Date().toISOString() }
    ).then((response) => {
      return response?.data?.cache[0] || null
    }).then((data) => {
      if (!data)
        return cb();
      if (data.expiresAt < (new Date())) return cb();
      if (data.compressed)
        return cb(null, store.decompress(data.value));
      return cb(null, data.value);
    }).catch(err => cb(err));
  }

/**
   * Keys an entry.
   *
   * @param {String} pattern
   * @param {} options
   * @param {fn} cb
   * @api public
   */

  keys(pattern, options, cb) {
    var store = this;

    if(!pattern || pattern === '*') pattern = '%';

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.keys(pattern, options, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }

    store.hasuraQuery(`
      query cacheKeys($pattern: String!, $currentTimestamp: timestamptz) {
        cache(where: { 
          key: { _like: $pattern },
          expiresAt: { _gte: $currentTimestamp }
        }) {
          key
        }
      }
    `, 
    { pattern, currentTimestamp: new Date().toISOString() }
    ).then((response) => {
      return (response?.data?.cache || []).map((value) => value.key)
    }).then((keys) => {
      return cb(null, keys);
    }).catch(err => cb(err));
  }

  /**
   * Set an entry.
   *
   * @param {String} key
   * @param {Mixed} val
   * @param {Object} options
   * @param {fn} cb
   * @api public
   */

  set(key, val, options, cb) {
    const store = this;

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.set(key, val, options, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }

    var expiresAt = new Date();
    //if new ttl generate expire Date else use standard TTL
    expiresAt.setTime(expiresAt.getTime() + ((options.ttl || store.options.ttl)  * 1000));

    var data = {
      key,
      value: options.compressed ? store.compress(val) : val,
      compressed: options.compressed ? true : false,
      expiresAt: expiresAt.toISOString()
    };
    var currentTimestamp = new Date().toISOString()

    store.hasuraQuery(`
      mutation cacheSet($key: String!, $value: String!, $compressed: Boolean!, $expiresAt: timestamptz, $currentTimestamp: timestamptz) {
        # remove expired keys on every update
        delete_cache(where: { expiresAt: { _lt: $currentTimestamp } }) {
          affected_rows
        }
        # updated cache
        insert_cache_one(
          object: {key: $key, value: $value, compressed: $compressed, expiresAt: $expiresAt},
          on_conflict: {constraint: cache_pkey, update_columns: [value, compressed, expiresAt]}) {
          key
          value
          compressed
          expiresAt
        }
      }
    `, 
    { ...data, currentTimestamp }
    ).then((response) => {
      return response?.data?.insert_cache_one
    }).then((data) => {
      return cb(null, data);
    }).catch(err => cb(err));
  }

  /**
   * Delete an entry.
   *
   * @param {String} key
   * @param {Object} options
   * @param {fn} cb
   * @api public
   */

  del(key, options, cb) {
    var store = this;

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.del(key, options, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }

    store.hasuraQuery(`
      mutation cacheDel($key: String!) {
        delete_cache(where: { key: { _eq: $key } }) {
          affected_rows
        }
      }
    `, 
    { key }
    ).then((response) => {
      return response?.data?.delete_cache?.affected_rows
    }).then((affected_rows) => {
      if (affected_rows)
        return cb(null, true);
      return cb(null, false);
    }).catch(err => cb(err));
  }

  /**
   * Clear all entries for this bucket.
   *
   * @param {String} key
   * @param {fn} cb
   * @api public
   */

  reset(pattern, cb) {
    var store = this;

    if (typeof pattern === 'function') {
      cb = pattern;
      pattern = null;
    }

    if(!pattern || pattern === '*') pattern = '%'

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.reset(pattern, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }
    store.hasuraQuery(`
      mutation cacheDel($pattern: String) {
        delete_cache(where: { key: { _like: $pattern } }) {
          affected_rows
        }
      }
    `, 
    { pattern }
    ).then((response) => {
      return response?.data?.delete_cache?.affected_rows
    }).then((affected_rows) => {
      // TODO: check affected_rows?
      return cb(null, true);
    })
    .catch(err => cb(err));
  }

  isCacheableValue(value) {
    return value !== null && value !== undefined;
  }
}

/**
 * Export `HasuraStore`.
 */

exports = module.exports = {
  create: (args) => {
    return new HasuraStore(args);
  }
};
