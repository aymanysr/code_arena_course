import { type MatchMode } from "arena-model";
import { MockMatchAuthority } from "./mock-authority.js";
import {
  type ArenaTransport,
  type ConnectionState,
  type FixtureTransportControls,
  type RunReceipt,
  type SubmitReceipt,
  TransportSession,
} from "./transport.js";
import type { ArenaSnapshot } from "./types.js";

/**
 * Fixture adapter for the UI's ArenaTransport seam.
 *
 * Match rules and fixture state live in MockMatchAuthority. This adapter only
 * translates authority changes into transport notifications and exposes the
 * same command surface as the production SocketArenaTransport.
 */
export class MockArenaTransport implements ArenaTransport {
  private readonly session = new TransportSession("connected");
  private readonly authority: MockMatchAuthority;

  constructor(mode: MatchMode = "1v1") {
    this.authority = new MockMatchAuthority(mode);
    this.authority.subscribe(() => this.session.notify());
  }

  connection(): ConnectionState {
    return this.session.connection();
  }

  scopeKey(): string {
    return `mock:${this.authority.snapshot().mode}`;
  }

  snapshot(): ArenaSnapshot {
    return this.authority.snapshot();
  }

  subscribe(listener: () => void): () => void {
    return this.session.subscribe(listener);
  }

  fixtureControls(): FixtureTransportControls {
    return {
      publishReveal: () => this.authority.publishRevealForDev(),
      nextRound: () => this.authority.nextRoundForDev(),
      setMateReady: (value) => this.authority.setMateReadyForDev(value),
    };
  }

  leave(): Promise<void> {
    return this.authority.leave();
  }

  setLanguage(language: string): Promise<void> {
    return this.authority.setLanguage(language);
  }

  startRound(): Promise<void> {
    return this.authority.startRound();
  }

  beginCoding(): Promise<void> {
    return this.authority.beginCoding();
  }

  advance(): Promise<void> {
    return this.authority.advance();
  }

  run(input: { code: string; language: string }): Promise<RunReceipt> {
    return this.authority.run(input);
  }

  submit(input: { code: string; language: string; documentRevision?: number }): Promise<SubmitReceipt> {
    return this.authority.submit(input);
  }

  setReady(value: boolean): Promise<void> {
    return this.authority.setReady(value);
  }

  /** Compatibility helpers used by fixture tests and local dev tooling. */
  setMateReadyForDev(value: boolean): void {
    this.authority.setMateReadyForDev(value);
  }

  bumpDocRevisionForDev(): void {
    this.authority.bumpDocRevisionForDev();
  }

  publishRevealForDev(): void {
    this.authority.publishRevealForDev();
  }

  nextRoundForDev(): void {
    this.authority.nextRoundForDev();
  }
}
