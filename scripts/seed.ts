import { seedDemoIfEmpty } from "../src/lib/seed"

const created = seedDemoIfEmpty()
console.log(created ? "Seeded the demo club." : "Database already has members; left it alone.")
