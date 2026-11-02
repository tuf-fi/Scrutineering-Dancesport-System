import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'
import { hashPassword } from '../auth/password.ts'
import * as t from './schema.ts'
import { SAMPLE_ATHLETE_EMAIL, SAMPLE_COACH_EMAIL, SAMPLE_PASSWORD, SAMPLE_TEAM_EMAIL, addSampleAthlete, addSampleMembers, addSampleAthleteData, addSampleCompetitorData, addSampleEntryData, addSamplePanels, addSampleUpcoming, hasData, seedSampleData } from './seed.ts'

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)

if (hasData(db)) {
  // Keeps existing data; only adds the sample athlete and upcoming competitions if this database predates them
  addSampleAthlete(db, hashPassword(SAMPLE_PASSWORD), db.select().from(t.clubs).limit(1).get()?.id ?? null)
  addSampleMembers(db, hashPassword(SAMPLE_PASSWORD))
  addSampleUpcoming(db)
  addSampleAthleteData(db)
  addSampleCompetitorData(db)
  addSampleEntryData(db)
  addSamplePanels(db)
  console.log(`${config.databasePath} already has data, so it was kept. Sample athlete: ${SAMPLE_ATHLETE_EMAIL}, coach: ${SAMPLE_COACH_EMAIL}, team: ${SAMPLE_TEAM_EMAIL}, password ${SAMPLE_PASSWORD}`)
} else {
  seedSampleData(db)
  addSampleUpcoming(db)
  addSampleAthleteData(db)
  addSampleCompetitorData(db)
  addSampleEntryData(db)
  addSamplePanels(db)
  console.log(`Sample competition loaded into ${config.databasePath}`)
  console.log(`Staff emails: admin@sample.example, secretariat@sample.example, scrutineer@sample.example, chairperson@sample.example, mc@sample.example. Password for all: ${SAMPLE_PASSWORD}`)
}
sqlite.close()
