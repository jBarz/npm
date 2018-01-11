'use strict'

const BB = require('bluebird')

var exec = require('child_process').exec
const spawn = require('./spawn')
const npm = require('../npm.js')
const which = require('which')
const git = npm.config.get('git')
const assert = require('assert')
const log = require('npmlog')
const noProgressTillDone = require('./no-progress-while-running.js').tillDone

exports.spawn = spawnGit
exports.exec = BB.promisify(execGit)
exports.chainableExec = chainableExec
exports.whichAndExec = whichAndExec

function prefixGitArgs () {
  return process.platform === 'win32' ? ['-c', 'core.longpaths=true'] : []
}

function execGit (args, options, cb) {
  log.info('git', args)
  var fullArgs = prefixGitArgs().concat(args || [])
  return exec(git + " " + fullArgs.join(' ') + " 2>&1 | cat", options, noProgressTillDone(cb))
}

function spawnGit (args, options) {
  log.info('gitjbar', args)
  gitproc = spawn(git, prefixGitArgs().concat(args || []), options)
  iconv = spawn('iconv', ['-f', 'iso8859-1', '-t', 'ibm-1047'])

  gitproc.stdout.on('data', function(data) {
    if (!iconv.stdin.write(data))
      gitproc.stdout.pause();
  });
  gitproc.stderr.on('data', function(data) {
    if (!iconv.stdin.write(data))
      gitproc.stderr.pause();
  });
  iconv.stdin.on('drain', function(data) {
    if (gitproc.stdout.isPausedl())
      gitproc.stdout.resume();
    if (gitproc.stderr.isPausedl())
      gitproc.stderr.resume();
  });
  gitproc.stdout.on('end', function(code) {
    iconv.stdin.end();
  });
  return iconv;
}

function chainableExec () {
  var args = Array.prototype.slice.call(arguments)
  return [execGit].concat(args)
}

function whichAndExec (args, options, cb) {
  assert.equal(typeof cb, 'function', 'no callback provided')
  // check for git
  which(git, function (err) {
    if (err) {
      err.code = 'ENOGIT'
      return cb(err)
    }

    execGit(args, options, cb)
  })
}
