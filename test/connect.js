'use strict';

var connect = require('../lib/connect').connect;
var credentialsFromUrl = require('../lib/connect').credentialsFromUrl;
var assert = require('assert');
var util = require('./util');
var net = require('net');
var fail = util.fail, succeed = util.succeed,
    kCallback = util.kCallback,
    succeedIfAttributeEquals = util.succeedIfAttributeEquals;
var format = require('util').format;

var URL = process.env.URL || 'amqp://localhost';

suite("Credentials", function() {

  function checkCreds(creds, user, pass, done) {
    if (creds.mechanism != 'PLAIN') {
      return done('expected mechanism PLAIN');
    }
    if (creds.username != user || creds.password != pass) {
      return done(format("expected '%s', '%s'; got '%s', '%s'",
                         user, pass, creds.username, creds.password));
    }
    done();
  }

  test("no creds", function(done) {
    var parts = {auth: ''};
    var creds = credentialsFromUrl(parts);
    checkCreds(creds, 'guest', 'guest', done);
  });
  test("usual user:pass", function(done) {
    var parts = {auth: 'user:pass'};
    var creds = credentialsFromUrl(parts);
    checkCreds(creds, 'user', 'pass', done);
  });
  test("missing user", function(done) {
    var parts = {auth: ':password'};
    var creds = credentialsFromUrl(parts);
    checkCreds(creds, '', 'password', done);
  });
  test("missing password", function(done) {
    var parts = {auth: 'username'};
    var creds = credentialsFromUrl(parts);
    checkCreds(creds, 'username', '', done);
  });
  test("colon in password", function(done) {
    var parts = {auth: 'username:pass:word'};
    var creds = credentialsFromUrl(parts);
    checkCreds(creds, 'username', 'pass:word', done);
  });
});

suite("Connect API", function() {

  test("Connection refused", function(done) {
    connect('amqp://localhost:23450', {},
            kCallback(fail(done), succeed(done)));
  });

  // %% this ought to fail the promise, rather than throwing an error
  test("bad URL", function() {
    assert.throws(function() {
      connect('blurble');
    });
  });

  test("wrongly typed open option", function(done) {
    var url = require('url');
    var parts = url.parse(URL, true);
    var q = parts.query || {};
    q.frameMax = 'NOT A NUMBER';
    parts.query = q;
    var u = url.format(parts);
    connect(u, {}, kCallback(fail(done), succeed(done)));
  });

  test("using custom heartbeat option", function(done) {
    var url = require('url');
    var parts = url.parse(URL, true);
    var config = parts.query || {};
    config.heartbeat = 20;
    connect(config, {}, kCallback(succeedIfAttributeEquals('heartbeat', 20, done), fail(done)));
  });

  test("wrongly typed heartbeat option", function(done) {
    var url = require('url');
    var parts = url.parse(URL, true);
    var config = parts.query || {};
    config.heartbeat = 'NOT A NUMBER';
    connect(config, {}, kCallback(fail(done), succeed(done)));
  });

  test("using plain credentials", function(done) {
    var url = require('url');
    var parts = url.parse(URL, true);
    var u = 'guest', p = 'guest';
    if (parts.auth) {
      var auth = parts.auth.split(":");
      u = auth[0], p = auth[1];
    }
    connect(URL, {credentials: require('../lib/credentials').plain(u, p)},
            kCallback(succeed(done), fail(done)));
  });

  test("using unsupported mechanism", function(done) {
    var creds = {
      mechanism: 'UNSUPPORTED',
      response: function() { return new Buffer(''); }
    };
    connect(URL, {credentials: creds},
            kCallback(fail(done), succeed(done)));
  });

  test("with a given connection timeout", function(done) {
    var timeoutServer = net.createServer(function() {}).listen(31991);

    connect('amqp://localhost:31991', {timeout: 50}, function(err, val) {
        timeoutServer.close();
        if (val) done(new Error('Expected connection timeout, did not'));
        else done();
    });
  });

});
