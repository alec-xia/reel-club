/**
 * Made-up club for the How page. tests/how.test.ts replays these scores
 * through movie_elo and checks the displayed board figures.
 * Enjoyment and quality are averaged (alpha 0.5). Everyone starts at 1500.
 */

export type ExampleScore = {
  name: string
  enjoy: number
  film: number
}

export type ExampleMovie = {
  suggester: string
  movie: string
  ratings: ExampleScore[]
}

export const EXAMPLE_MEMBERS = ["Alex", "Bea", "Cam", "Dee"] as const

export const NIGHT_BUS: ExampleMovie = {
  suggester: "Alex",
  movie: "Night Bus",
  ratings: [
    { name: "Bea", enjoy: 8, film: 6 },
    { name: "Cam", enjoy: 7, film: 7 },
    { name: "Dee", enjoy: 9, film: 5 },
  ],
}

export const ROOFTOP: ExampleMovie = {
  suggester: "Bea",
  movie: "Rooftop",
  ratings: [
    { name: "Alex", enjoy: 8, film: 8 },
    { name: "Cam", enjoy: 8, film: 8 },
    { name: "Dee", enjoy: 9, film: 7 },
  ],
}

/** Cam's later edit of Rooftop. Night Bus is unchanged. */
export const ROOFTOP_CAM_EDIT = { enjoy: 4, film: 4 }

/**
 * Rooftop vs Night Bus, rounded the way the board shows Elo and deltas.
 * Bea +8.3 to 1508.3, Alex -8.3 to 1491.7. Cam and Dee stay at 1500.
 */
export const ROOFTOP_RESULT = {
  beaDelta: "+8.3",
  beaAfter: "1508.3",
  alexAfter: "1491.7",
  camAfter: "1500.0",
  deeAfter: "1500.0",
}

/** Same comparison after Cam's edit. No later movie in the example. */
export const ROOFTOP_EDITED_RESULT = {
  beaDelta: "-8.3",
  beaAfter: "1491.7",
  alexAfter: "1508.3",
}

export function blend(enjoy: number, film: number): number {
  return (enjoy + film) / 2
}

export function scoreOf(movie: ExampleMovie, name: string): ExampleScore {
  const row = movie.ratings.find((rating) => rating.name === name)
  if (!row) throw new Error(`${name} did not score ${movie.movie}`)
  return row
}
