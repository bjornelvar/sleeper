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
        points: startingPoints
      });
    }

    // Add current week’s live points + wins if still in regular season
    if (Number.isFinite(week) && week > 0 && seasonType === "regular" && week < playoffStart) {
      const matchups = await fetchJSON(`${API_BASE}/league/${leagueId}/matchups/${week}`);
      const grouped = new Map();
      for (const m of matchups) {
        if (!grouped.has(m.matchup_id)) grouped.set(m.matchup_id, []);
        grouped.get(m.matchup_id).push(m);
      }
      for (const pair of grouped.values()) {
        if (pair.length !== 2) continue;
        const [a, b] = pair;
        const aPts = Number(a?.points ?? 0), bPts = Number(b?.points ?? 0);

        if (rosterMap.has(a.roster_id)) rosterMap.get(a.roster_id).points += aPts;
        if (rosterMap.has(b.roster_id)) rosterMap.get(b.roster_id).points += bPts;

        if (aPts > bPts && rosterMap.has(a.roster_id)) rosterMap.get(a.roster_id).wins += 1;
        else if (bPts > aPts && rosterMap.has(b.roster_id)) rosterMap.get(b.roster_id).wins += 1;
      }
    }

    const standings = Array.from(rosterMap.values())
      .sort((x, y) => (y.wins - x.wins) || (y.points - x.points))
      .map((e, i) => ({ rank: i + 1, name: e.name, wins: e.wins, points: e.points }));

    render(standings);
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
