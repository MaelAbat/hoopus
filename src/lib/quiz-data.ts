/**
 * NBA Quiz data for Hoopiz.
 * Each quiz has a title, description, time limit, and entries to guess.
 */

export interface QuizEntry {
  /** The answer(s) accepted (lowercase, first is display value) */
  answers: string[];
  /** Hints/columns shown in the table */
  hints: Record<string, string>;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  timeLimit: number; // seconds
  columns: { key: string; label: string; width?: string }[];
  /** Column key that the user needs to guess */
  answerColumn: string;
  entries: QuizEntry[];
}

export const QUIZZES: Quiz[] = [
  {
    id: "palmares-nba",
    title: "Palmarès NBA",
    description: "Retrouve tous les champions NBA depuis 1980. Tu as 8 minutes !",
    timeLimit: 480,
    columns: [
      { key: "year", label: "Année", width: "60px" },
      { key: "answer", label: "Champion", width: "140px" },
      { key: "finals", label: "Finale", width: "160px" },
    ],
    answerColumn: "answer",
    entries: [
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1980", finals: "vs. 76ers (4-2)" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "1981", finals: "vs. Rockets (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1982", finals: "vs. 76ers (4-2)" } },
      { answers: ["76ers", "philadelphia 76ers", "sixers"], hints: { year: "1983", finals: "vs. Lakers (4-0)" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "1984", finals: "vs. Lakers (4-3)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1985", finals: "vs. Celtics (4-2)" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "1986", finals: "vs. Rockets (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1987", finals: "vs. Celtics (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1988", finals: "vs. Pistons (4-3)" } },
      { answers: ["pistons", "detroit pistons"], hints: { year: "1989", finals: "vs. Lakers (4-0)" } },
      { answers: ["pistons", "detroit pistons"], hints: { year: "1990", finals: "vs. Trail Blazers (4-1)" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1991", finals: "vs. Lakers (4-1)" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1992", finals: "vs. Trail Blazers (4-2)" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1993", finals: "vs. Suns (4-2)" } },
      { answers: ["rockets", "houston rockets"], hints: { year: "1994", finals: "vs. Knicks (4-3)" } },
      { answers: ["rockets", "houston rockets"], hints: { year: "1995", finals: "vs. Magic (4-0)" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1996", finals: "vs. SuperSonics (4-2)" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1997", finals: "vs. Jazz (4-2)" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1998", finals: "vs. Jazz (4-2)" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "1999", finals: "vs. Knicks (4-1)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2000", finals: "vs. Pacers (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2001", finals: "vs. 76ers (4-1)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2002", finals: "vs. Nets (4-0)" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "2003", finals: "vs. Nets (4-2)" } },
      { answers: ["pistons", "detroit pistons"], hints: { year: "2004", finals: "vs. Lakers (4-1)" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "2005", finals: "vs. Pistons (4-3)" } },
      { answers: ["heat", "miami heat"], hints: { year: "2006", finals: "vs. Mavericks (4-2)" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "2007", finals: "vs. Cavaliers (4-0)" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "2008", finals: "vs. Lakers (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2009", finals: "vs. Magic (4-1)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2010", finals: "vs. Celtics (4-3)" } },
      { answers: ["mavericks", "dallas mavericks", "mavs"], hints: { year: "2011", finals: "vs. Heat (4-2)" } },
      { answers: ["heat", "miami heat"], hints: { year: "2012", finals: "vs. Thunder (4-1)" } },
      { answers: ["heat", "miami heat"], hints: { year: "2013", finals: "vs. Spurs (4-3)" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "2014", finals: "vs. Heat (4-1)" } },
      { answers: ["warriors", "golden state warriors", "gsw"], hints: { year: "2015", finals: "vs. Cavaliers (4-2)" } },
      { answers: ["cavaliers", "cleveland cavaliers", "cavs"], hints: { year: "2016", finals: "vs. Warriors (4-3)" } },
      { answers: ["warriors", "golden state warriors", "gsw"], hints: { year: "2017", finals: "vs. Cavaliers (4-1)" } },
      { answers: ["warriors", "golden state warriors", "gsw"], hints: { year: "2018", finals: "vs. Cavaliers (4-0)" } },
      { answers: ["raptors", "toronto raptors"], hints: { year: "2019", finals: "vs. Warriors (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2020", finals: "vs. Heat (4-2)" } },
      { answers: ["bucks", "milwaukee bucks"], hints: { year: "2021", finals: "vs. Suns (4-2)" } },
      { answers: ["warriors", "golden state warriors", "gsw"], hints: { year: "2022", finals: "vs. Celtics (4-2)" } },
      { answers: ["nuggets", "denver nuggets"], hints: { year: "2023", finals: "vs. Heat (4-1)" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "2024", finals: "vs. Mavericks (4-1)" } },
    ],
  },
];
