const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { main } = require('../../src/cli');

const BILLING_V1 = `/**
 * Compute the total price of the line items in a cart, applying the discount rate.
 */
function computeCartTotal(items, discountRate) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.unitPrice * item.quantity;
  }
  const discount = subtotal * (discountRate || 0);
  return Math.round((subtotal - discount) * 100) / 100;
}

function formatCurrency(amount, currency) {
  return \`\${currency || 'USD'} \${amount.toFixed(2)}\`;
}

module.exports = { computeCartTotal, formatCurrency };
`;

function git(cwd, args) {
  return execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Temp git repo where computeCartTotal is renamed to sumLineItems in the second commit. */
function makeRenameRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtro-e2e-'));
  git(dir, ['init', '-q']);
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'billing.js'), BILLING_V1);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'Add billing helpers']);
  fs.writeFileSync(path.join(dir, 'src', 'billing.js'), BILLING_V1.replace(/computeCartTotal/g, 'sumLineItems'));
  git(dir, ['commit', '-qam', 'Rename computeCartTotal to sumLineItems']);
  return dir;
}

/** Run the CLI in-process, capturing output. */
async function run(argv, { cwd, env = {} } = {}) {
  let stdout = '', stderr = '';
  const io = { stdout: { write: s => { stdout += s; } }, stderr: { write: s => { stderr += s; } }, cwd, env: { ...process.env, ...env } };
  const code = await main(argv, io);
  return { code, stdout, stderr };
}

/** Use a throwaway HOME so global config never touches the real one. */
function withTempHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rtro-home-'));
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return { home, restore: () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } } };
}

module.exports = { makeRenameRepo, run, git, withTempHome, BILLING_V1 };
