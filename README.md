Node Cache Manager store for Hasura GraphQL engine
==================================

[![Test with Github Actions](https://github.com/euknyaz/node-cache-manager-hasura/workflows/node-cache-manager-hasura/badge.svg)](https://github.com/euknyaz/node-cache-manager-hasura/actions?query=workflow%3Anode-cache-manager-hasura)

The Hasura store for the [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager) module. 


Installation
------------

```sh
npm install cache-manager-hasura --save
```

Requirements
------------

Required components:
* Hasura GraphQL Engine v1.3.x
* PostgresSQL Database v11+

Required configuration:
* Table "cache" should exist in PostgreSQL Database
  * Look at hasura/migrations/1613268748000_inital_schema/up.sql
  ```sql
    CREATE TABLE "public"."cache" (
        "key"          TEXT NOT NULL PRIMARY KEY,
        value          TEXT NULL,
        compressed     BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at     TIMESTAMPTZ
    );
  ```
* Table cache should be tracked by hasura (with necessary fields mapping)
  * Look at hasura/metadata/tables.yaml
  ```yaml
    - table:
    schema: public
    name: cache
      configuration:
        custom_root_fields: {}
        custom_column_names:
          expires_at: expiresAt
  ```

Usage examples
--------------

Here are examples that demonstrate how to implement the Mongodb cache store.

### Single store

```js
var cacheManager = require('cache-manager');
var hasuraStore = require('cache-manager-hasura');


var cache = cacheManager.caching({
    store : hasuraStore,
    uri : "http://localhost:3001/v1/graphql",
    options : {
      secret : "secret", // from env HASURA_GRAPHQL_ADMIN_SECRET
      compression : false,
      ttl : 600, // default "time to live" for cache records
    }
  });

var ttl = 60;

cache.set('foo', 'bar', ttl)
	.then(()=>{
     return cache.get('foo')
	}).then((result) => {
        console.log(result);
        // >> 'bar'
        return cache.del('foo');
    });
});

function getUser(id) {
    return new Promise((resolve,reject)=>{
    setTimeout(function () {
        console.log("Returning user from slow database.");
        return resolve({id: id, name: 'Bob'});
    }, 100);
}

var userId = 123;
var key = 'user_' + userId;

// Note: ttl is optional in wrap()
cache.wrap(key, function () {
    return getUserPromise(userId);
}, ttl)
    .then((user) => {
   	 console.log(user);

    // Second time fetches user from mongoCache
    cache.wrap(key, function () {
       return getUserPromise(userId);
    }.then(( user) => {
        console.log(user);
    });
});

```

### Multi-store

```js
var cacheManager = require('cache-manager');
var hasuraStore = require('cache-manager-hasura');
var hasuraCache = cacheManager.caching({
    store : hasuraStore,
    uri : "http://localhost:3001/v1/graphql",
    options : {
        adminSecret : "<HASURA-ADMIN-SECRET>",
        compression : false,
        ttl : 600,
    }
});
var memoryCache = cacheManager.caching({store: 'memory', max: 100, ttl: 60});

var multiCache = cacheManager.multiCaching([memoryCache, hasuraCache]);


userId2 = 456;
key2 = 'user_' + userId;
ttl = 5;

// Sets in all caches.
multiCache.set('foo2', 'bar2', ttl)
    .then(()=>{
    	// Fetches from highest priority cache that has the key.
    	return multiCache.get('foo2')
	}).then((result) => {
        console.log(result);
        // >> 'bar2'
        // Delete from all caches
        return multiCache.del('foo2');
    });
});

// Note: ttl is optional in wrap()
multiCache.wrap(key2, function () {
    return getUserPromise(userId2);
}, ttl)
.then((user) => {
   		console.log(user);
   		 // Second time fetches user from memoryCache, since it's highest priority.
    	// If the data expires in the memory cache, the next fetch would pull it from
    	// the 'someOtherCache', and set the data in memory again.
    	return multiCache.wrap(key2, function () {
     	   return getUserPromise(userId2);
    	});
}).then((user)=>{
    console.log(user);
});

function getUserPromise(id) {
    return new Promise((resolve,reject)=>{
        setTimeout(function () {
       	 console.log("Returning user from slow database.");
       	 return resolve({id: id, name: 'Bob'});
 	 	}, 100);
    })
});
```

Credits
------------
Thanks to owner of https://github.com/v4l3r10/node-cache-manager-mongodb repository for the foundation of code to implement this module.

Contribution
------------

If you would like to contribute to the project, please fork it and send us a pull request.

License
-------

`node-cache-manager-hasura` is licensed under the MIT license.
