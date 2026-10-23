#!/usr/bin/env node
'use strict';
// Retrospect CLI entry point ("rtro", alias "retrospect").
require('../src/cli').main(process.argv.slice(2)).then(code => { process.exitCode = code; });
