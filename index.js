const API_BASE = "https://api.sleeper.app/v1";

const form = document.getElementById("search-form");
const errorDiv = document.getElementById("error");
const leagueSection = document.getElementById("league-selection");
const leagueList = document.getElementById("league-list");
const goButton = document.getElementById("go-button");

leagueSection.classList.add("hidden");
goButton.disabled = true;

form.addEventListener("submit", async e => {
  e.preventDefault();
  errorDiv.textContent = "";
  leagueList.innerHTML = "";
  leagueSection.classList.add("hidden");
  goButton.disabled = true;

  const username = document.getElementById("username").value.trim();
  const year = document.getElementById("year").value;
  const sport = "nfl";

  try {
    const resUser = await fetch(`${API_BASE}/user/${username}`);
    if (!resUser.ok) throw new Error("User not found");
    const { user_id } = await resUser.json();

    const resLeagues = await fetch(`${API_BASE}/user/${user_id}/leagues/${sport}/${year}`);
    if (!resLeagues.ok) throw new Error("No leagues found");
    const leagues = await resLeagues.json();
    if (!leagues.length) throw new Error("No leagues for that year");

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
