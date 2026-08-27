'use strict';

/**
 * A minimal in-memory fake of the Fabric chaincode stub, covering exactly the surface
 * MrvContract uses (getState/putState, getTxTimestamp, setEvent, getQueryResult with simple
 * equality selectors, getHistoryForKey). This is deliberately a working fake rather than a
 * mock-every-call setup, so tests exercise real contract behavior (state actually persists
 * between calls within a test, history actually accumulates) instead of asserting on call
 * counts.
 */
class FakeStub {
  constructor() {
    this.state = new Map();
    this.history = new Map(); // key -> [{txId, timestamp, isDelete, value}]
    this.events = [];
    this._txCounter = 0;
    this._clockSeconds = 1_700_000_000; // arbitrary fixed epoch, advances per call
  }

  async getState(key) {
    return this.state.has(key) ? Buffer.from(JSON.stringify(this.state.get(key))) : Buffer.alloc(0);
  }

  async putState(key, buffer) {
    this._txCounter += 1;
    this._clockSeconds += 1;
    const value = JSON.parse(buffer.toString('utf8'));
    this.state.set(key, value);
    if (!this.history.has(key)) this.history.set(key, []);
    this.history.get(key).push({
      txId: `tx-${this._txCounter}`,
      timestamp: { seconds: { low: this._clockSeconds } },
      isDelete: false,
      value: buffer,
    });
  }

  getTxTimestamp() {
    this._clockSeconds += 1;
    return { seconds: { low: this._clockSeconds }, nanos: 0 };
  }

  setEvent(name, payload) {
    this.events.push({ name, payload: JSON.parse(payload.toString('utf8')) });
  }

  async getQueryResult(queryString) {
    const { selector } = JSON.parse(queryString);
    const matches = [...this.state.entries()].filter(([, value]) =>
      Object.entries(selector).every(([field, expected]) => value[field] === expected)
    );
    let i = 0;
    return {
      next: async () => {
        if (i >= matches.length) return { done: true };
        const [, value] = matches[i];
        i += 1;
        return { done: false, value: { value: Buffer.from(JSON.stringify(value)) } };
      },
      close: async () => {},
    };
  }

  async getHistoryForKey(key) {
    const entries = this.history.get(key) || [];
    let i = 0;
    return {
      next: async () => {
        if (i >= entries.length) return { done: true };
        const value = entries[i];
        i += 1;
        return { done: false, value };
      },
      close: async () => {},
    };
  }
}

class FakeContext {
  constructor() {
    this.stub = new FakeStub();
  }
}

module.exports = { FakeStub, FakeContext };
