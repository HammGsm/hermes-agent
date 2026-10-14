/**
 * Observador de mensajes del bridge (`HERMES_WA_OBSERVER`).
 *
 * El bridge no persiste conversaciones: `messageQueue` se vacía en cada poll y
 * `messageStore` es una caché acotada (512, solo quotes/polls). Sin esta línea
 * por mensaje, "qué se dijo hoy en el grupo X" es irrecuperable pasado el
 * momento. Estos tests fijan el contrato del helper puro; el call-site no se
 * puede importar (`bridge.js` arranca el socket al cargar).
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { appendObservedLine, observedLine, observerEnabled } from './bridge_helpers.js';

test('observerEnabled: solo un "off" explícito apaga', () => {
  assert.equal(observerEnabled(undefined), true);   // default on
  assert.equal(observerEnabled('on'), true);
  assert.equal(observerEnabled('TRUE'), true);
  assert.equal(observerEnabled('1'), true);
  assert.equal(observerEnabled('off'), false);
  assert.equal(observerEnabled(''), false);         // "" es una elección explícita
});

test('observedLine: una línea JSON, con fromMe y texto', () => {
  const line = observedLine({
    direction: 'in',
    fromMe: false,
    chatId: '120363022203381143@g.us',
    senderId: '51940397467',
    messageId: 'ABC123',
    text: 'hola grupo',
    hasMedia: false,
  }, new Date('2026-10-13T20:00:00Z'));

  assert.ok(line.endsWith('\n'), 'debe terminar en salto de línea');
  assert.equal(line.split('\n').length, 2, 'una sola línea');
  const obj = JSON.parse(line);
  assert.equal(obj.ts, '2026-10-13T20:00:00.000Z');
  assert.equal(obj.direction, 'in');
  assert.equal(obj.fromMe, false);
  assert.equal(obj.chatId, '120363022203381143@g.us');
  assert.equal(obj.sender, '51940397467');
  assert.equal(obj.messageId, 'ABC123');
  assert.equal(obj.text, 'hola grupo');
});

test('observedLine: campos ausentes quedan vacíos, nunca undefined', () => {
  const obj = JSON.parse(observedLine({ chatId: 'g@g.us' }));
  for (const key of ['sender', 'messageId', 'text', 'mediaType', 'quotedText']) {
    assert.equal(obj[key], '', `${key} debe ser ''`);
  }
  assert.equal(obj.hasMedia, false);
});

test('observedLine: un mensaje con media conserva el tipo', () => {
  const obj = JSON.parse(observedLine({ chatId: 'g@g.us', hasMedia: true, mediaType: 'image', text: 'pie de foto' }));
  assert.equal(obj.hasMedia, true);
  assert.equal(obj.mediaType, 'image');
  assert.equal(obj.text, 'pie de foto');
});

test('appendObservedLine: crea el directorio y acumula sin pisar', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'hermes-wa-observer-'));
  const file = path.join(dir, 'anidado', 'observed.jsonl');
  try {
    assert.equal(appendObservedLine(file, observedLine({ chatId: 'a@g.us', text: 'uno' })), true);
    assert.equal(appendObservedLine(file, observedLine({ chatId: 'a@g.us', text: 'dos' })), true);
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2, 'append, no truncado');
    assert.equal(JSON.parse(lines[1]).text, 'dos');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendObservedLine: ruta imposible devuelve false y no lanza', () => {
  // Un fallo de log no puede tumbar el intake del mensaje.
  assert.equal(appendObservedLine('/proc/self/mem/nope.jsonl', 'x\n'), false);
});
