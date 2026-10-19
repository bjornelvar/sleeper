const API_BASE = "https://api.sleeper.app/v1";
const params = new URLSearchParams(location.search);
const leagueId = params.get("leagueId");
const leagueName = params.get("leagueName") ?? "League";

const $ = (sel) => document.querySelector(sel);
const leagueEl = $("#league-name");
const weekEl = $("#week-label");
const listEl = $("#standings");
const loadingEl = $("#loading");
const errorEl = $("#error");
const modeEl = $("#mode");

if (leagueEl) leagueEl.textContent = leagueName;

const fmt2 = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : n;
};

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function load() {
  try {
    if (!leagueId) {
      throw new Error("Missing leagueId. Add ?leagueId=<SLEEPER_LEAGUE_ID> to the URL.");
    }

    loadingEl?.classList.remove("hidden");
    errorEl.textContent = "";

    // Fetch core state + league
    const [state, league] = await Promise.all([
      fetchJSON(`${API_BASE}/state/nfl`),
      fetchJSON(`${API_BASE}/league/${leagueId}`)
    ]);

    const week = Number(state?.week ?? 0);
    const playoffStart = Number(league?.settings?.playoff_week_start ?? Number.POSITIVE_INFINITY);
    const seasonType = league?.season_type || state?.season_type || "regular";

    if (weekEl && Number.isFinite(week) && week > 0) {
      weekEl.textContent = `Week ${week}${seasonType !== "regular" ? ` • ${seasonType}` : ""}`;
    }

    // Rosters + Users
    const [rosters, users] = await Promise.all([
      fetchJSON(`${API_BASE}/league/${leagueId}/rosters`),
      fetchJSON(`${API_BASE}/league/${leagueId}/users`)
    ]);

    const userMap = new Map(users.map(u => [u.user_id, u]));
    const rosterMap = new Map();

    for (const r of rosters) {
      const baseFpts = Number(r?.settings?.fpts ?? 0);
      const baseFptsDec = Number(r?.settings?.fpts_decimal ?? 0);
      const startingPoints = baseFpts + baseFptsDec / 100;

      const wins = Number(r?.settings?.wins ?? 0);
      const ownerId = r?.owner_id ?? null;

      const rosterTeamName = r?.metadata?.team_name?.trim?.();
      const userName = userMap.get(ownerId)?.display_name?.trim?.();

      const name =
        (rosterTeamName && rosterTeamName.length > 0) ? rosterTeamName :
        (userName && userName.length > 0) ? userName :
        `Team ${r?.roster_id}`;

      rosterMap.set(r.roster_id, {
        rosterId: r.roster_id,
        name,
        wins,
        points: startingPoints,
        // This week's points and win (0/1), per mode
        week: { live: 0, proj: 0 },
        weekWin: { live: 0, proj: 0 }
      });
    }

    // Add current week’s live + projected points and wins if still in regular season
    if (Number.isFinite(week) && week > 0 && seasonType === "regular" && week < playoffStart) {
      const [matchups, projections, schedule] = await Promise.all([
        fetchJSON(`${API_BASE}/league/${leagueId}/matchups/${week}`),
        fetchJSON(`https://api.sleeper.com/projections/nfl/${state.season}/${week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF`),
        fetchJSON(`https://api.sleeper.com/schedule/nfl/regular/${state.season}`)
      ]);
      // Score projected stats with the league's own scoring settings (handles custom scoring)
      const scoring = league?.scoring_settings ?? {};
      const gameStatus = new Map(schedule.map(g => [g.game_id, g.status]));
      const projById = new Map(projections.map(p => [p.player_id, {
        pts: Object.entries(p.stats ?? {}).reduce((sum, [k, v]) => sum + v * (scoring[k] ?? 0), 0),
        status: gameStatus.get(p.game_id)
      }]));

      for (const m of matchups) {
        const e = rosterMap.get(m.roster_id);
        if (!e) continue;
        e.week.live = Number(m.points ?? 0);
        e.week.proj = (m.starters ?? []).reduce((sum, id) => {
          const actual = Number(m.players_points?.[id] ?? 0);
          const p = projById.get(id);
          if (!p || p.status === "complete") return sum + actual;
          if (p.status === "pre_game") return sum + p.pts;
          // ponytail: mid-game player = max(actual, projection); no game clock in the API to blend by.
          return sum + Math.max(actual, p.pts);
        }, 0);
      }

      const grouped = new Map();
      for (const m of matchups) {
        if (!grouped.has(m.matchup_id)) grouped.set(m.matchup_id, []);
        grouped.get(m.matchup_id).push(m);
      }
      for (const pair of grouped.values()) {
        if (pair.length !== 2) continue;
        const [a, b] = pair.map(m => rosterMap.get(m.roster_id));
        if (!a || !b) continue;
        for (const mode of ["live", "proj"]) {
          if (a.week[mode] > b.week[mode]) a.weekWin[mode] = 1;
          else if (b.week[mode] > a.week[mode]) b.weekWin[mode] = 1;
        }
      }
      modeEl?.classList.remove("hidden");
    }

    const standingsFor = (mode) => Array.from(rosterMap.values())
      .map(e => ({ name: e.name, wins: e.wins + e.weekWin[mode], points: e.points + e.week[mode] }))
      .sort((x, y) => (y.wins - x.wins) || (y.points - x.points))
      .map((e, i) => ({ rank: i + 1, ...e }));

    const selectedMode = () => modeEl?.querySelector("input:checked")?.value ?? "live";
    modeEl?.addEventListener("change", () => render(standingsFor(selectedMode())));
    render(standingsFor(selectedMode()));
  } catch (err) {
    errorEl.textContent = err?.message ?? String(err);
    console.error(err);
  } finally {
    loadingEl?.classList.add("hidden");
  }
}

function render(items) {
  listEl.innerHTML = "";
  for (const t of items) {
    const li = document.createElement("li");
    li.className = "row";

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = t.rank;

    const team = document.createElement("div");
    team.className = "team";
    team.textContent = t.name ?? "";

    const metrics = document.createElement("div");
    metrics.className = "metrics";
    metrics.innerHTML = `
      <span class="metric"><span class="k">W</span><span class="v">${Number(t.wins ?? 0)}</span></span>
      <span class="metric"><span class="k">PTS</span><span class="v">${fmt2(t.points ?? 0)}</span></span>
    `;

    li.append(rank, team, metrics);
    listEl.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", load);
