const leaders = {
  points: [
    { rank: 1, name: "Luka Doncic", team: "DAL", value: "33.4" },
    { rank: 2, name: "Shai Gilgeous-Alexander", team: "OKC", value: "31.8" },
    { rank: 3, name: "Jayson Tatum", team: "BOS", value: "28.9" },
    { rank: 4, name: "Giannis Antetokounmpo", team: "MIL", value: "28.1" },
    { rank: 5, name: "Kevin Durant", team: "PHX", value: "27.3" },
  ],
  rebounds: [
    { rank: 1, name: "Domantas Sabonis", team: "SAC", value: "13.8" },
    { rank: 2, name: "Victor Wembanyama", team: "SAS", value: "12.1" },
    { rank: 3, name: "Nikola Jokic", team: "DEN", value: "11.9" },
    { rank: 4, name: "Anthony Davis", team: "LAL", value: "11.5" },
    { rank: 5, name: "Rudy Gobert", team: "MIN", value: "11.2" },
  ],
  assists: [
    { rank: 1, name: "Tyrese Haliburton", team: "IND", value: "11.2" },
    { rank: 2, name: "Nikola Jokic", team: "DEN", value: "10.1" },
    { rank: 3, name: "Trae Young", team: "ATL", value: "9.8" },
    { rank: 4, name: "LaMelo Ball", team: "CHA", value: "8.9" },
    { rank: 5, name: "James Harden", team: "LAC", value: "8.5" },
  ],
};

function LeaderBoard({ title, data, unit }: { title: string; data: typeof leaders.points; unit: string }) {
  return (
    <div className="rounded-2xl bg-[#111827] border border-white/5 overflow-hidden">
      <div className="border-b border-white/5 px-6 py-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      <div className="divide-y divide-white/5">
        {data.map((player) => (
          <div
            key={player.rank}
            className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02]"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                player.rank === 1
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-white/5 text-gray-500"
              }`}
            >
              {player.rank}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-white">{player.name}</p>
              <p className="text-xs text-gray-500">{player.team}</p>
            </div>
            <span className="text-lg font-bold text-white">
              {player.value}
              <span className="ml-1 text-xs font-normal text-gray-500">{unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Statistiques() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Statistiques</h1>
        <p className="mt-1 text-gray-500">Leaders de la saison 2025-26</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <LeaderBoard title="Points" data={leaders.points} unit="PPG" />
        <LeaderBoard title="Rebonds" data={leaders.rebounds} unit="RPG" />
        <LeaderBoard title="Passes" data={leaders.assists} unit="APG" />
      </div>
    </div>
  );
}
