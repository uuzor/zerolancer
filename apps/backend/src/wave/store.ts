import Database from "better-sqlite3";
import path from "node:path";

export interface WaveProgramRow {
  programId: string;
  organizer: string;
  token: string;
  genesisPool: string;
  numWaves: string;
  buildWindow: string;
  evalWindow: string;
  complimentWindow: string;
  budgetMethod: string;
  feeBps: string;
  treasury: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaveProjectRow {
  id: string;
  programId: string;
  waveId: string;
  builder: string;
  team: string;
  repoUrl: string;
  repoHash: string;
  contentHash: string;
  description: string;
  status: string;
  pointsAwarded: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaveBuilderRow {
  address: string;
  programId: string;
  name: string;
  bio: string;
  repoUrl: string;
  appliedAt: string;
}

export interface WavePointsRow {
  id: string;
  programId: string;
  waveId: string;
  builder: string;
  projectId: string;
  points: string;
  kind: string;
  awardedBy: string;
  createdAt: string;
}

const DB_PATH = process.env.ZERO_WAVE_DB_PATH ?? path.join(process.cwd(), "data", "wave.sqlite");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(`
      CREATE TABLE IF NOT EXISTS wave_programs (
        programId TEXT PRIMARY KEY,
        organizer TEXT NOT NULL,
        token TEXT NOT NULL,
        genesisPool TEXT NOT NULL,
        numWaves TEXT NOT NULL,
        buildWindow TEXT NOT NULL,
        evalWindow TEXT NOT NULL,
        complimentWindow TEXT NOT NULL,
        budgetMethod TEXT NOT NULL,
        feeBps TEXT NOT NULL,
        treasury TEXT NOT NULL,
        description TEXT DEFAULT '',
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS wave_projects (
        id TEXT PRIMARY KEY,
        programId TEXT NOT NULL,
        waveId TEXT NOT NULL,
        builder TEXT NOT NULL,
        team TEXT DEFAULT '',
        repoUrl TEXT NOT NULL,
        repoHash TEXT NOT NULL,
        contentHash TEXT DEFAULT '',
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'submitted',
        pointsAwarded TEXT DEFAULT '0',
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS wave_builders (
        address TEXT NOT NULL,
        programId TEXT NOT NULL,
        name TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        repoUrl TEXT DEFAULT '',
        appliedAt TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (address, programId)
      );
      CREATE TABLE IF NOT EXISTS wave_points (
        id TEXT PRIMARY KEY,
        programId TEXT NOT NULL,
        waveId TEXT NOT NULL,
        builder TEXT NOT NULL,
        projectId TEXT NOT NULL,
        points TEXT NOT NULL,
        kind TEXT NOT NULL,
        awardedBy TEXT NOT NULL,
        createdAt TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_wave_projects_program_wave ON wave_projects(programId, waveId);
      CREATE INDEX IF NOT EXISTS idx_wave_points_program_wave_builder ON wave_points(programId, waveId, builder);
    `);
  }
  return db;
}

export class WaveStore {
  // -- programs -----------------------------------------------------------
  upsertProgram(row: WaveProgramRow): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO wave_programs (programId, organizer, token, genesisPool, numWaves, buildWindow, evalWindow, complimentWindow, budgetMethod, feeBps, treasury, description, updatedAt)
      VALUES (@programId, @organizer, @token, @genesisPool, @numWaves, @buildWindow, @evalWindow, @complimentWindow, @budgetMethod, @feeBps, @treasury, @description, datetime('now'))
      ON CONFLICT(programId) DO UPDATE SET
        organizer = excluded.organizer, token = excluded.token, genesisPool = excluded.genesisPool,
        numWaves = excluded.numWaves, buildWindow = excluded.buildWindow, evalWindow = excluded.evalWindow,
        complimentWindow = excluded.complimentWindow, budgetMethod = excluded.budgetMethod, feeBps = excluded.feeBps,
        treasury = excluded.treasury, description = excluded.description, updatedAt = excluded.updatedAt
    `).run(row);
  }

  getProgram(programId: string): WaveProgramRow | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM wave_programs WHERE programId = ?").get(programId) as WaveProgramRow | undefined;
    return row;
  }

  listPrograms(): WaveProgramRow[] {
    const db = getDb();
    return db.prepare("SELECT * FROM wave_programs ORDER BY createdAt DESC").all() as WaveProgramRow[];
  }

  // -- projects ----------------------------------------------------------
  insertProject(row: WaveProjectRow): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO wave_projects (id, programId, waveId, builder, team, repoUrl, repoHash, contentHash, description, status, pointsAwarded, createdAt, updatedAt)
      VALUES (@id, @programId, @waveId, @builder, @team, @repoUrl, @repoHash, @contentHash, @description, @status, @pointsAwarded, datetime('now'), datetime('now'))
    `).run(row);
  }

  getProject(id: string): WaveProjectRow | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM wave_projects WHERE id = ?").get(id) as WaveProjectRow | undefined;
    return row;
  }

  listProjectsByWave(programId: string, waveId: string): WaveProjectRow[] {
    const db = getDb();
    return db.prepare("SELECT * FROM wave_projects WHERE programId = ? AND waveId = ? ORDER BY createdAt DESC").all(programId, waveId) as WaveProjectRow[];
  }

  listProjectsByBuilder(builder: string): WaveProjectRow[] {
    const db = getDb();
    return db.prepare("SELECT * FROM wave_projects WHERE builder = ? ORDER BY createdAt DESC").all(builder) as WaveProjectRow[];
  }

  updateProjectStatus(id: string, status: string): void {
    const db = getDb();
    db.prepare("UPDATE wave_projects SET status = ?, updatedAt = datetime('now') WHERE id = ?").run(status, id);
  }

  // -- builders ----------------------------------------------------------
  upsertBuilder(row: WaveBuilderRow): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO wave_builders (address, programId, name, bio, repoUrl, appliedAt)
      VALUES (@address, @programId, @name, @bio, @repoUrl, datetime('now'))
      ON CONFLICT(address, programId) DO UPDATE SET
        name = excluded.name, bio = excluded.bio, repoUrl = excluded.repoUrl
    `).run(row);
  }

  getBuilder(address: string, programId: string): WaveBuilderRow | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM wave_builders WHERE address = ? AND programId = ?").get(address, programId) as WaveBuilderRow | undefined;
    return row;
  }

  listBuilders(programId: string): WaveBuilderRow[] {
    const db = getDb();
    return db.prepare("SELECT * FROM wave_builders WHERE programId = ? ORDER BY appliedAt DESC").all(programId) as WaveBuilderRow[];
  }

  // -- points ------------------------------------------------------------
  insertPoints(row: WavePointsRow): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO wave_points (id, programId, waveId, builder, projectId, points, kind, awardedBy, createdAt)
      VALUES (@id, @programId, @waveId, @builder, @projectId, @points, @kind, @awardedBy, datetime('now'))
    `).run(row);
  }

  getPointsForWave(programId: string, waveId: string): WavePointsRow[] {
    const db = getDb();
    return db.prepare("SELECT * FROM wave_points WHERE programId = ? AND waveId = ? ORDER BY createdAt DESC").all(programId, waveId) as WavePointsRow[];
  }

  getPointsForBuilder(programId: string, waveId: string, builder: string): WavePointsRow[] {
    const db = getDb();
    return db.prepare("SELECT * FROM wave_points WHERE programId = ? AND waveId = ? AND builder = ? ORDER BY createdAt DESC").all(programId, waveId, builder) as WavePointsRow[];
  }
}

export const waveStore = new WaveStore();
