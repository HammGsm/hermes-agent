/**
 * Compuerta del bridge: "solo responder a autorizados", probada por EFECTO con
 * la función REAL y los ficheros de sesión REALES (lid-mapping-*.json).
 *
 * No basta con leer el .env: el bridge recibe su allowlist por env del adapter,
 * y el gate decide con `matchesAllowedUser`. Este test ejerce esa decisión.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';

import { matchesAllowedUser, matchesInboundWhatsAppGroup, parseAllowedUsers } from './allowlist.js';

const SESSION_DIR = process.env.HERMES_WA_SESSION_DIR || '/root/.hermes/whatsapp/session';

test('allowlist vacía = NADIE pasa (default seguro)', () => {
  const empty = parseAllowedUsers('');
  assert.equal(empty.size, 0);
  // Antes "vacío -> true" dejaba que un desconocido disparara el bot.
  assert.equal(matchesAllowedUser('51940397467', empty, SESSION_DIR), false);
  assert.equal(matchesInboundWhatsAppGroup({
    chatId: '120363022203381143@g.us', groupPolicy: 'allowlist', groupAllowedUsers: empty, sessionDir: SESSION_DIR,
  }), false);
});

test('"*" es la única forma de abrir', () => {
  assert.equal(matchesAllowedUser('51999999999', parseAllowedUsers('*'), SESSION_DIR), true);
});

test('grupo autorizado pasa; otro grupo no', () => {
  const groups = parseAllowedUsers('120363022203381143,120363266091206350');
  assert.equal(matchesInboundWhatsAppGroup({
    chatId: '120363022203381143@g.us', groupPolicy: 'allowlist', groupAllowedUsers: groups, sessionDir: SESSION_DIR,
  }), true);
  assert.equal(matchesInboundWhatsAppGroup({
    chatId: '999999999999@g.us', groupPolicy: 'allowlist', groupAllowedUsers: groups, sessionDir: SESSION_DIR,
  }), false, 'un grupo NO listado debe quedar fuera');
});

test('policy disabled/pairing cierra los grupos aunque haya allowlist', () => {
  const groups = parseAllowedUsers('120363022203381143');
  for (const policy of ['disabled', 'pairing']) {
    assert.equal(matchesInboundWhatsAppGroup({
      chatId: '120363022203381143@g.us', groupPolicy: policy, groupAllowedUsers: groups, sessionDir: SESSION_DIR,
    }), false, `${policy} debe cerrar`);
  }
});

test('policy open deja pasar sin allowlist', () => {
  assert.equal(matchesInboundWhatsAppGroup({
    chatId: '999999999999@g.us', groupPolicy: 'open', groupAllowedUsers: parseAllowedUsers(''), sessionDir: SESSION_DIR,
  }), true);
});

test('remitente NO autorizado queda fuera del DM', () => {
  const users = parseAllowedUsers('51940397467,190430276755536,51910242329');
  assert.equal(matchesAllowedUser('51940397467', users, SESSION_DIR), true, 'autorizado');
  assert.equal(matchesAllowedUser('51999999999', users, SESSION_DIR), false, 'desconocido');
});
