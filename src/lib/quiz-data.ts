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
      { key: "year", label: "Année", width: "80px" },
      { key: "answer", label: "Champion", width: "200px" },
      { key: "finals", label: "Finale", width: "200px" },
      { key: "mvp", label: "MVP des Finals", width: "180px" },
    ],
    answerColumn: "answer",
    entries: [
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1980", finals: "vs. 76ers (4-2)", mvp: "Magic Johnson" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "1981", finals: "vs. Rockets (4-2)", mvp: "Cedric Maxwell" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1982", finals: "vs. 76ers (4-2)", mvp: "Magic Johnson" } },
      { answers: ["76ers", "philadelphia 76ers", "sixers"], hints: { year: "1983", finals: "vs. Lakers (4-0)", mvp: "Moses Malone" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "1984", finals: "vs. Lakers (4-3)", mvp: "Larry Bird" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1985", finals: "vs. Celtics (4-2)", mvp: "Kareem Abdul-Jabbar" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "1986", finals: "vs. Rockets (4-2)", mvp: "Larry Bird" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1987", finals: "vs. Celtics (4-2)", mvp: "Magic Johnson" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "1988", finals: "vs. Pistons (4-3)", mvp: "James Worthy" } },
      { answers: ["pistons", "detroit pistons"], hints: { year: "1989", finals: "vs. Lakers (4-0)", mvp: "Joe Dumars" } },
      { answers: ["pistons", "detroit pistons"], hints: { year: "1990", finals: "vs. Trail Blazers (4-1)", mvp: "Isiah Thomas" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1991", finals: "vs. Lakers (4-1)", mvp: "Michael Jordan" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1992", finals: "vs. Trail Blazers (4-2)", mvp: "Michael Jordan" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1993", finals: "vs. Suns (4-2)", mvp: "Michael Jordan" } },
      { answers: ["rockets", "houston rockets"], hints: { year: "1994", finals: "vs. Knicks (4-3)", mvp: "Hakeem Olajuwon" } },
      { answers: ["rockets", "houston rockets"], hints: { year: "1995", finals: "vs. Magic (4-0)", mvp: "Hakeem Olajuwon" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1996", finals: "vs. SuperSonics (4-2)", mvp: "Michael Jordan" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1997", finals: "vs. Jazz (4-2)", mvp: "Michael Jordan" } },
      { answers: ["bulls", "chicago bulls"], hints: { year: "1998", finals: "vs. Jazz (4-2)", mvp: "Michael Jordan" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "1999", finals: "vs. Knicks (4-1)", mvp: "Tim Duncan" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2000", finals: "vs. Pacers (4-2)", mvp: "Shaquille O'Neal" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2001", finals: "vs. 76ers (4-1)", mvp: "Shaquille O'Neal" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2002", finals: "vs. Nets (4-0)", mvp: "Shaquille O'Neal" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "2003", finals: "vs. Nets (4-2)", mvp: "Tim Duncan" } },
      { answers: ["pistons", "detroit pistons"], hints: { year: "2004", finals: "vs. Lakers (4-1)", mvp: "Chauncey Billups" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "2005", finals: "vs. Pistons (4-3)", mvp: "Tim Duncan" } },
      { answers: ["heat", "miami heat"], hints: { year: "2006", finals: "vs. Mavericks (4-2)", mvp: "Dwyane Wade" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "2007", finals: "vs. Cavaliers (4-0)", mvp: "Tony Parker" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "2008", finals: "vs. Lakers (4-2)", mvp: "Paul Pierce" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2009", finals: "vs. Magic (4-1)", mvp: "Kobe Bryant" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2010", finals: "vs. Celtics (4-3)", mvp: "Kobe Bryant" } },
      { answers: ["mavericks", "dallas mavericks", "mavs"], hints: { year: "2011", finals: "vs. Heat (4-2)", mvp: "Dirk Nowitzki" } },
      { answers: ["heat", "miami heat"], hints: { year: "2012", finals: "vs. Thunder (4-1)", mvp: "LeBron James" } },
      { answers: ["heat", "miami heat"], hints: { year: "2013", finals: "vs. Spurs (4-3)", mvp: "LeBron James" } },
      { answers: ["spurs", "san antonio spurs"], hints: { year: "2014", finals: "vs. Heat (4-1)", mvp: "Kawhi Leonard" } },
      { answers: ["warriors", "golden state warriors", "gsw"], hints: { year: "2015", finals: "vs. Cavaliers (4-2)", mvp: "Andre Iguodala" } },
      { answers: ["cavaliers", "cleveland cavaliers", "cavs"], hints: { year: "2016", finals: "vs. Warriors (4-3)", mvp: "LeBron James" } },
      { answers: ["warriors", "golden state warriors", "gsw"], hints: { year: "2017", finals: "vs. Cavaliers (4-1)", mvp: "Kevin Durant" } },
      { answers: ["warriors", "golden state warriors", "gsw"], hints: { year: "2018", finals: "vs. Cavaliers (4-0)", mvp: "Kevin Durant" } },
      { answers: ["raptors", "toronto raptors"], hints: { year: "2019", finals: "vs. Warriors (4-2)", mvp: "Kawhi Leonard" } },
      { answers: ["lakers", "los angeles lakers", "la lakers"], hints: { year: "2020", finals: "vs. Heat (4-2)", mvp: "LeBron James" } },
      { answers: ["bucks", "milwaukee bucks"], hints: { year: "2021", finals: "vs. Suns (4-2)", mvp: "Giannis Antetokounmpo" } },
      { answers: ["warriors", "golden state warriors", "gsw"], hints: { year: "2022", finals: "vs. Celtics (4-2)", mvp: "Stephen Curry" } },
      { answers: ["nuggets", "denver nuggets"], hints: { year: "2023", finals: "vs. Heat (4-1)", mvp: "Nikola Jokic" } },
      { answers: ["celtics", "boston celtics"], hints: { year: "2024", finals: "vs. Mavericks (4-1)", mvp: "Jaylen Brown" } },
      { answers: ["thunder", "oklahoma city thunder", "okc"], hints: { year: "2025", finals: "vs. Pacers (4-1)", mvp: "Shai Gilgeous-Alexander" } },
    ],
  },
];
