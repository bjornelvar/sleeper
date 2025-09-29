const API_BASE = "https://api.sleeper.app/v1";

const form = document.getElementById("search-form");
const errorDiv = document.getElementById("error");
const leagueSection = document.getElementById("league-selection");
const leagueList = document.getElementById("league-list");
const goButton = document.getElementById("go-button");
const seasonHint = document.getElementById("season-hint");

leagueSection.classList.add("hidden");
goButton.disabled = true;

function computeSeasonYear(d = new Date()) {
  // Season runs Aug 31 (Y) -> Aug 30 (Y+1). If today >= Aug 31 this year, season = this year; else prev year.
  const y = d.getFullYear();
  const seasonStartThisYear = new Date(y, 7, 31); // month is 0-based: 7 = August
  return d >= seasonStartThisYear ? y : y - 1;
}

function formatRangeForSeason(y) {
  // For display only
  const start = `Aug 31, ${y}`;
  const end = `Aug 30, ${y + 1}`;
  return `${start} – ${end}`;
}

// Show the auto season hint on load
const seasonYear = computeSeasonYear();
if (seasonHint) seasonHint.textContent = `Season: ${seasonYear}  (${formatRangeForSeason(seasonYear)})`;

form.addEventListener("submit", async e => {
  e.preventDefault();
  errorDiv.textContent = "";
  leagueList.innerHTML = "";
  leagueSection.classList.add("hidden");
  goButton.disabled = true;

  const username = document.getElementById("username").value.trim();
  const sport = "nfl";
  const year = seasonYear;

  try {
    const resUser = await fetch(`${API_BASE}/user/${encodeURIComponent(username)}`);
    if (!resUser.ok) throw new Error("User not found");
    const { user_id } = await resUser.json();

    const resLeagues = await fetch(`${API_BASE}/user/${user_id}/leagues/${sport}/${year}`);
    if (!resLeagues.ok) throw new Error("No leagues found");
    const leagues = await resLeagues.json();
    if (!leagues.length) throw new Error("No leagues for that season");

    for (const l of leagues) {
      const opt = document.createElement("option");
      opt.value = l.league_id;
      opt.textContent = l.name;
      leagueList.appendChild(opt);
    }

    leagueSection.classList.remove("hidden");
    goButton.disabled = false;
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

goButton.addEventListener("click", () => {
  const leagueId = leagueList.value;
  const leagueName = encodeURIComponent(leagueList.options[leagueList.selectedIndex].text);
  window.location.href = `league.html?leagueId=${leagueId}&leagueName=${leagueName}`;
});
