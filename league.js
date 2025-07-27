const API_BASE = "https://api.sleeper.app/v1";
const params = new URLSearchParams(window.location.search);
const leagueId = params.get("leagueId");
const leagueName = params.get("leagueName") || "League";

document.getElementById("league-name").textContent = decodeURIComponent(leagueName);
const loadingDiv = document.getElementById("loading");
const errorDiv = document.getElementById("error");

async function fetchStandings() {
    try {
        // State to get current week and playoff start
        const state = await (await fetch(`${API_BASE}/state/nfl`)).json();
        const settings = await (await fetch(`${API_BASE}/league/${leagueId}`)).json();
        const week = state.week;
        const playoffStart = settings.settings.playoff_week_start;

        // Rosters & users
        const rosters = await (await fetch(`${API_BASE}/league/${leagueId}/rosters`)).json();
        const users = await (await fetch(`${API_BASE}/league/${leagueId}/users`)).json();
        const rosterMap = {};
        rosters.forEach(r => { rosterMap[r.roster_id] = { wins: r.settings.wins || 0, points: r.settings.fpts + (r.settings.fpts_decimal || 0) / 100, ownerId: r.owner_id }; });
        users.forEach(u => {
            const entry = Object.values(rosterMap).find(x => x.ownerId === u.user_id);
            if (entry) entry.name = u.display_name;
        });

        let matchups = [];
        if (week < playoffStart) {
            matchups = await (await fetch(`${API_BASE}/league/${leagueId}/matchups/${week}`)).json();
            // accumulate wins/points from matchups
            const grouped = {};
            matchups.forEach(m => { grouped[m.matchup_id] = grouped[m.matchup_id] || []; grouped[m.matchup_id].push(m); });
            Object.values(grouped).forEach(pair => {
                if (pair.length === 2) {
                    const [a, b] = pair;
                    rosterMap[a.roster_id].points += a.points;
                    rosterMap[b.roster_id].points += b.points;
                    if (a.points > b.points) rosterMap[a.roster_id].wins++;
                    else if (b.points > a.points) rosterMap[b.roster_id].wins++;
                }
            });
        }

        // sort
        const standings = Object.values(rosterMap)
            .sort((a, b) => b.wins - a.wins || b.points - a.points)
            .map((entry, i) => ({ rank: i + 1, name: entry.name, wins: entry.wins, points: entry.points }));

        renderStandings(standings);
    } catch (err) {
        errorDiv.textContent = err.message;
    } finally {
        loadingDiv.classList.add("hidden");
    }
}

function renderStandings(data) {
    const tbody = document.querySelector("#standings-table tbody");
    tbody.innerHTML = "";
    data.forEach(team => {
        const tr = document.createElement("tr");
        [team.rank, team.name, team.wins, team.points].forEach(val => {
            const td = document.createElement("td"); td.textContent = val; tr.append(td);
        });
        tbody.append(tr);
    });
}

document.addEventListener("DOMContentLoaded", fetchStandings);