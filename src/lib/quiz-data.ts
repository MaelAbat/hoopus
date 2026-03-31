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
    description: "Retrouve tous les champions NBA depuis 1947. Tu as 12 minutes !",
    timeLimit: 720,
    columns: [
      { key: "year", label: "Année", width: "60px" },
      { key: "answer", label: "Champion", width: "140px" },
      { key: "finals", label: "Finale", width: "160px" },
    ],
    answerColumn: "answer",
    entries: [
      { answers: ["warriors", "philadelphia warriors", "philadelphia"], hints: { year: "1947", finals: "vs. Stags (4-1)" } },
      { answers: ["bullets", "baltimore bullets", "baltimore"], hints: { year: "1948", finals: "vs. Warriors (4-2)" } },
      { answers: ["lakers", "minneapolis lakers", "minneapolis"], hints: { year: "1949", finals: "vs. Capitols (4-2)" } },
      { answers: ["lakers", "minneapolis lakers", "minneapolis"], hints: { year: "1950", finals: "vs. Nationals (4-2)" } },
      { answers: ["royals", "rochester royals", "rochester"], hints: { year: "1951", finals: "vs. Knicks (4-3)" } },
      { answers: ["lakers", "minneapolis lakers", "minneapolis"], hints: { year: "1952", finals: "vs. Knicks (4-3)" } },
      { answers: ["lakers", "minneapolis lakers", "minneapolis"], hints: { year: "1953", finals: "vs. Knicks (4-1)" } },
      { answers: ["lakers", "minneapolis lakers", "minneapolis"], hints: { year: "1954", finals: "vs. Nationals (4-3)" } },
      { answers: ["nationals", "syracuse nationals", "syracuse"], hints: { year: "1955", finals: "vs. Pistons (4-3)" } },
      { answers: ["warriors", "philadelphia warriors", "philadelphia"], hints: { year: "1956", finals: "vs. Pistons (4-1)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1957", finals: "vs. Hawks (4-3)" } },
      { answers: ["hawks", "st. louis hawks", "saint louis hawks", "st louis hawks"], hints: { year: "1958", finals: "vs. Celtics (4-2)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1959", finals: "vs. Lakers (4-0)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1960", finals: "vs. Hawks (4-3)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1961", finals: "vs. Hawks (4-1)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1962", finals: "vs. Lakers (4-3)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1963", finals: "vs. Lakers (4-2)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1964", finals: "vs. Warriors (4-1)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1965", finals: "vs. Lakers (4-1)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1966", finals: "vs. Lakers (4-3)" } },
      { answers: ["76ers", "philadelphia 76ers", "philadelphia", "sixers", "philadelphie"], hints: { year: "1967", finals: "vs. Warriors (4-2)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1968", finals: "vs. Lakers (4-2)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1969", finals: "vs. Lakers (4-3)" } },
      { answers: ["knicks", "new york knicks", "new york"], hints: { year: "1970", finals: "vs. Lakers (4-3)" } },
      { answers: ["bucks", "milwaukee bucks", "milwaukee"], hints: { year: "1971", finals: "vs. Bullets (4-0)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "1972", finals: "vs. Knicks (4-1)" } },
      { answers: ["knicks", "new york knicks", "new york"], hints: { year: "1973", finals: "vs. Lakers (4-1)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1974", finals: "vs. Bucks (4-3)" } },
      { answers: ["warriors", "golden state warriors", "golden state"], hints: { year: "1975", finals: "vs. Bullets (4-0)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1976", finals: "vs. Suns (4-2)" } },
      { answers: ["trail blazers", "portland trail blazers", "portland", "blazers"], hints: { year: "1977", finals: "vs. 76ers (4-2)" } },
      { answers: ["bullets", "washington bullets", "washington"], hints: { year: "1978", finals: "vs. SuperSonics (4-3)" } },
      { answers: ["supersonics", "seattle supersonics", "seattle", "sonics"], hints: { year: "1979", finals: "vs. Bullets (4-1)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "1980", finals: "vs. 76ers (4-2)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1981", finals: "vs. Rockets (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "1982", finals: "vs. 76ers (4-2)" } },
      { answers: ["76ers", "philadelphia 76ers", "philadelphia", "sixers", "philadelphie"], hints: { year: "1983", finals: "vs. Lakers (4-0)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1984", finals: "vs. Lakers (4-3)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "1985", finals: "vs. Celtics (4-2)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "1986", finals: "vs. Rockets (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "1987", finals: "vs. Celtics (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "1988", finals: "vs. Pistons (4-3)" } },
      { answers: ["pistons", "detroit pistons", "detroit"], hints: { year: "1989", finals: "vs. Lakers (4-0)" } },
      { answers: ["pistons", "detroit pistons", "detroit"], hints: { year: "1990", finals: "vs. Trail Blazers (4-1)" } },
      { answers: ["bulls", "chicago bulls", "chicago"], hints: { year: "1991", finals: "vs. Lakers (4-1)" } },
      { answers: ["bulls", "chicago bulls", "chicago"], hints: { year: "1992", finals: "vs. Trail Blazers (4-2)" } },
      { answers: ["bulls", "chicago bulls", "chicago"], hints: { year: "1993", finals: "vs. Suns (4-2)" } },
      { answers: ["rockets", "houston rockets", "houston"], hints: { year: "1994", finals: "vs. Knicks (4-3)" } },
      { answers: ["rockets", "houston rockets", "houston"], hints: { year: "1995", finals: "vs. Magic (4-0)" } },
      { answers: ["bulls", "chicago bulls", "chicago"], hints: { year: "1996", finals: "vs. SuperSonics (4-2)" } },
      { answers: ["bulls", "chicago bulls", "chicago"], hints: { year: "1997", finals: "vs. Jazz (4-2)" } },
      { answers: ["bulls", "chicago bulls", "chicago"], hints: { year: "1998", finals: "vs. Jazz (4-2)" } },
      { answers: ["spurs", "san antonio spurs", "san antonio"], hints: { year: "1999", finals: "vs. Knicks (4-1)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "2000", finals: "vs. Pacers (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "2001", finals: "vs. 76ers (4-1)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "2002", finals: "vs. Nets (4-0)" } },
      { answers: ["spurs", "san antonio spurs", "san antonio"], hints: { year: "2003", finals: "vs. Nets (4-2)" } },
      { answers: ["pistons", "detroit pistons", "detroit"], hints: { year: "2004", finals: "vs. Lakers (4-1)" } },
      { answers: ["spurs", "san antonio spurs", "san antonio"], hints: { year: "2005", finals: "vs. Pistons (4-3)" } },
      { answers: ["heat", "miami heat", "miami"], hints: { year: "2006", finals: "vs. Mavericks (4-2)" } },
      { answers: ["spurs", "san antonio spurs", "san antonio"], hints: { year: "2007", finals: "vs. Cavaliers (4-0)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "2008", finals: "vs. Lakers (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "2009", finals: "vs. Magic (4-1)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "2010", finals: "vs. Celtics (4-3)" } },
      { answers: ["mavericks", "dallas mavericks", "dallas", "mavs"], hints: { year: "2011", finals: "vs. Heat (4-2)" } },
      { answers: ["heat", "miami heat", "miami"], hints: { year: "2012", finals: "vs. Thunder (4-1)" } },
      { answers: ["heat", "miami heat", "miami"], hints: { year: "2013", finals: "vs. Spurs (4-3)" } },
      { answers: ["spurs", "san antonio spurs", "san antonio"], hints: { year: "2014", finals: "vs. Heat (4-1)" } },
      { answers: ["warriors", "golden state warriors", "golden state"], hints: { year: "2015", finals: "vs. Cavaliers (4-2)" } },
      { answers: ["cavaliers", "cleveland cavaliers", "cleveland", "cavs"], hints: { year: "2016", finals: "vs. Warriors (4-3)" } },
      { answers: ["warriors", "golden state warriors", "golden state"], hints: { year: "2017", finals: "vs. Cavaliers (4-1)" } },
      { answers: ["warriors", "golden state warriors", "golden state"], hints: { year: "2018", finals: "vs. Cavaliers (4-0)" } },
      { answers: ["raptors", "toronto raptors", "toronto"], hints: { year: "2019", finals: "vs. Warriors (4-2)" } },
      { answers: ["lakers", "los angeles lakers", "los angeles"], hints: { year: "2020", finals: "vs. Heat (4-2)" } },
      { answers: ["bucks", "milwaukee bucks", "milwaukee"], hints: { year: "2021", finals: "vs. Suns (4-2)" } },
      { answers: ["warriors", "golden state warriors", "golden state"], hints: { year: "2022", finals: "vs. Celtics (4-2)" } },
      { answers: ["nuggets", "denver nuggets", "denver"], hints: { year: "2023", finals: "vs. Heat (4-1)" } },
      { answers: ["celtics", "boston celtics", "boston"], hints: { year: "2024", finals: "vs. Mavericks (4-1)" } },
    ],
  },
];
