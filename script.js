    let showArchived = false;
    let sourceChart = null;
    let priorityChart = null;
    let selectedSources = [];
    let currentFiltered = [];
    let currentPage = 1;
    const perPage = 10;

    function resetPage() {
      currentPage = 1;
    }

    function exitArchivedView() {
      if (showArchived) {
        showArchived = false;
        const at = document.getElementById("arch-toggle");
        at.classList.remove("on");
        at.textContent = "Show Archived";
      }
    }

    function showToast(message) {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(function () {
        toast.classList.remove("show");
      }, 2000);
    }

    function fmtDate(d) {
      if (!d) return "—";
      const dt = new Date(d);
      if (isNaN(dt)) return "—";
      return dt.toLocaleString();
    }

    function val(x) {
      return (x === undefined || x === null || x === "") ? "—" : x;
    }

    function openDetail(bug, index) {
      const body = document.getElementById("detail-body");
      document.getElementById("detail-title").textContent = bug.endpoint || "Bug details";

      const fields = [
        ["Message", val(bug.message)],
        ["Source", val(bug.source)],
        ["Status", val(bug.status)],
        ["Priority", val(bug.priority)],
        ["Count", val(bug.count)],
        ["Method", val(bug.method)],
        ["Page", val(bug.page)],
        ["Error Type", val(bug.errorType)],
        ["Ticket ID", val(bug.ticketId)],
        ["Ticket Status", val(bug.ticketStatus)],
        ["Browser / OS", val(bug.browser)],
        ["Account", val(bug.account)],
        ["First Seen", fmtDate(bug.createdAt)],
        ["Last Seen", fmtDate(bug.lastSeen)],
        ["Resolved At", bug.resolvedAt ? fmtDate(bug.resolvedAt) : "—"],
        ["Archived", bug.archived ? "Yes" : "No"]
      ];

      let html = "";
      fields.forEach(function (f) {
        html += "<div class='detail-row'><div class='k'>" + f[0] + "</div><div class='v'>" + f[1] + "</div></div>";
      });
      const presets = ["Working on it", "Need more info", "Known issue", "Cannot reproduce"];
      html += "<div class='notes-box'>";
      html += "<div class='k'>Notes</div>";
      html += "<div class='note-presets'>";
      presets.forEach(function (p) {
        const active = (bug.notes === p) ? " active" : "";
        html += "<button class='note-preset" + active + "' data-id='" + bug._id + "' data-note='" + p + "'>" + p + "</button>";
      });
      html += "</div>";
      html += "<textarea id='note-text' placeholder='Extra note...'>" + (bug.notes && !presets.includes(bug.notes) ? bug.notes : "") + "</textarea>";
      html += "<button id='note-save' data-id='" + bug._id + "'>Save note</button>";
      html += "</div>";
      body.innerHTML = html;
      document.querySelectorAll(".note-preset").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          const id = this.getAttribute("data-id");
          const note = this.getAttribute("data-note");
          await fetch("/api/bugs/" + id + "/notes", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: note })
          });
          document.querySelectorAll(".note-preset").forEach(function (b) { b.classList.remove("active"); });
          this.classList.add("active");
          const pi = pageItems.find(function(x){return x._id === id;}); if (pi) pi.notes = note;
        });
      });
      document.getElementById("note-save").addEventListener("click", async function () {
        const id = this.getAttribute("data-id");
        const text = document.getElementById("note-text").value;
        await fetch("/api/bugs/" + id + "/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: text })
        });
        const pi = pageItems.find(function(x){return x._id === id;}); if (pi) pi.notes = text;
        this.textContent = "Saved";
        setTimeout(function () { document.getElementById("note-save").textContent = "Save note"; }, 1500);
      });
      document.getElementById("detail-overlay").classList.add("open");
    }

    function renderSourceChecks(bugs) {
      const sources = Array.from(new Set(bugs.map(function (b) { return b.source; })));
      const box = document.getElementById("source-checks");

      if (selectedSources.length === 0) {
        selectedSources = sources.slice();
      }

      box.innerHTML = "";
      sources.forEach(function (src) {
        const checked = selectedSources.indexOf(src) !== -1 ? "checked" : "";
        box.innerHTML +=
          "<label class='source-check'>" +
            "<input type='checkbox' value='" + src + "' " + checked + "> " + src +
          "</label>";
      });

      box.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
        cb.addEventListener("change", function () {
          resetPage();
          exitArchivedView();
          if (cb.checked) {
            if (selectedSources.indexOf(cb.value) === -1) {
              selectedSources.push(cb.value);
            }
          } else {
            selectedSources = selectedSources.filter(function (s) {
              return s !== cb.value;
            });
          }
          loadBugs();
        });
      });
    }

    function renderActiveFilters(fStatus, fPriority) {
      const box = document.getElementById("active-filters");
      const chips = [];

      const totalSources = window.totalSourceCount || 0;
      if (selectedSources.length > 0 && selectedSources.length < totalSources) {
        chips.push("Source: " + selectedSources.join(", "));
      }
      if (fStatus) {
        chips.push("Status: " + fStatus);
      }
      if (fPriority) {
        chips.push("Priority: " + fPriority);
      }
      if (showArchived) {
        chips.push("Archived view");
      }

      if (chips.length === 0) {
        box.innerHTML = "";
        return;
      }

      let html = "<span>Active filters:</span>";
      chips.forEach(function (c) {
        html += "<span class='filter-chip'>" + c + "</span>";
      });
      html += "<button class='clear-filters' id='clear-filters'>Clear all</button>";
      box.innerHTML = html;

      document.getElementById("clear-filters").addEventListener("click", function () {
        selectedSources = Array.from(new Set((window.allBugs || []).map(function (b) { return b.source; })));
        document.getElementById("filter-status").value = "";
        document.getElementById("filter-priority").value = "";
        document.querySelectorAll(".status-pill").forEach(function (p) {
          p.classList.remove("active");
        });
        if (showArchived) {
          showArchived = false;
          const at = document.getElementById("arch-toggle");
          at.classList.remove("on");
          at.textContent = "Show Archived";
        }
        resetPage();
        loadBugs();
      });
    }

    function renderPagination(totalPages) {
      const box = document.getElementById("pagination");

      if (totalPages <= 1) {
        box.innerHTML = "";
        return;
      }

      box.innerHTML =
        "<button id='prev-page'>Previous</button>" +
        "<span class='page-info'>Page " + currentPage + " of " + totalPages + "</span>" +
        "<button id='next-page'>Next</button>";

      const prev = document.getElementById("prev-page");
      const next = document.getElementById("next-page");

      if (currentPage === 1) prev.disabled = true;
      if (currentPage === totalPages) next.disabled = true;

      prev.addEventListener("click", function () {
        if (currentPage > 1) {
          currentPage = currentPage - 1;
          loadBugs();
        }
      });

      next.addEventListener("click", function () {
        if (currentPage < totalPages) {
          currentPage = currentPage + 1;
          loadBugs();
        }
      });
    }

    function renderSourceChart(bugs) {
      const counts = {};
      bugs.forEach(function (b) {
        counts[b.source] = (counts[b.source] || 0) + 1;
      });

      const labels = Object.keys(counts);
      const data = Object.values(counts);

      const ctx = document.getElementById("source-chart");

      if (sourceChart) {
        sourceChart.destroy();
      }

      sourceChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Bugs",
            data: data,
            backgroundColor: "#1976d2"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    function renderPriorityChart(bugs) {
      const order = ["P0", "P1", "P2", "P3"];
      const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
      bugs.forEach(function (b) {
        if (counts[b.priority] !== undefined) {
          counts[b.priority] = counts[b.priority] + 1;
        }
      });

      const data = order.map(function (p) { return counts[p]; });

      const ctx = document.getElementById("priority-chart");

      if (priorityChart) {
        priorityChart.destroy();
      }

      priorityChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: order,
          datasets: [{
            label: "Bugs",
            data: data,
            backgroundColor: ["#d32f2f", "#f57f17", "#fbc02d", "#9e9e9e"]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    async function loadBugs() {
      const response = await fetch("/api/bugs");
      const bugs = await response.json();

      window.allBugs = bugs;
      const now = new Date();
      document.getElementById("last-updated").textContent = "Last updated: " + now.toLocaleTimeString();
      window.totalSourceCount = new Set(bugs.map(function (b) { return b.source; })).size;

      const total = bugs.length;
      const p0Count = bugs.filter(function (b) { return b.priority === "P0"; }).length;
      const newCount = bugs.filter(function (b) { return b.status === "New"; }).length;
      const sourceCount = new Set(bugs.map(function (b) { return b.source; })).size;

      document.getElementById("t-total").textContent = total;
      document.getElementById("t-p0").textContent = p0Count;
      document.getElementById("t-new").textContent = newCount;
      document.getElementById("t-sources").textContent = sourceCount;

      const newC = bugs.filter(function (b) { return b.status === "New"; }).length;
      const progC = bugs.filter(function (b) { return b.status === "In progress"; }).length;
      const doneC = bugs.filter(function (b) { return b.status === "Done"; }).length;
      document.getElementById("s-new").textContent = newC;
      document.getElementById("s-prog").textContent = progC;
      document.getElementById("s-done").textContent = doneC;

      renderSourceChecks(bugs);

      const fStatus = document.getElementById("filter-status").value;
      const fPriority = document.getElementById("filter-priority").value;
      renderActiveFilters(fStatus, fPriority);

      const filtered = bugs.filter(function (b) {
        if (showArchived) {
          if (!b.archived) return false;
        } else {
          if (b.archived) return false;
        }
        if (selectedSources.indexOf(b.source) === -1) return false;
        if (fStatus && b.status !== fStatus) return false;
        if (fPriority && b.priority !== fPriority) return false;
        return true;
      });

      filtered.sort(function (a, b) {
        const dateA = new Date(a.lastSeen || a.createdAt || 0);
        const dateB = new Date(b.lastSeen || b.createdAt || 0);
        return dateB - dateA;
      });

      currentFiltered = filtered;

      const totalPages = Math.ceil(filtered.length / perPage) || 1;
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * perPage;
      const pageItems = filtered.slice(start, start + perPage);

      const rows = pageItems.map(function (bug) {
        return "<tr>" +
          "<td>" + bug.endpoint + "</td>" +
          "<td>" + bug.message + "</td>" +
          "<td>" + bug.source + "</td>" +
          "<td>" +
            "<select data-id='" + bug._id + "' class='status-" + bug.status.replace(' ', '') + "'>" +
              "<option" + (bug.status === "New" ? " selected" : "") + ">New</option>" +
              "<option" + (bug.status === "In progress" ? " selected" : "") + ">In progress</option>" +
              "<option" + (bug.status === "Done" ? " selected" : "") + ">Done</option>" +
            "</select>" +
          "</td>" +
          "<td><span class='prio prio-" + bug.priority + "'>" + bug.priority + "</span></td>" +
          "<td>" + bug.count + "</td>" +
          "<td>" +
            (bug.archived
              ? "<button class='unarch-btn' data-id='" + bug._id + "'>Unarchive</button>"
              : (bug.status === "Done"
                  ? "<button class='arch-btn' data-id='" + bug._id + "'>Archive</button>"
                  : "<button class='del-btn' data-id='" + bug._id + "'>Delete</button>")) +
          "</td>" +
          "</tr>";
      });

      document.getElementById("bug-rows").innerHTML = rows.join("");
      renderPagination(totalPages);

      document.querySelectorAll("#bug-rows tr").forEach(function (tr, index) {
        tr.addEventListener("click", function (e) {
          if (e.target.closest("select") || e.target.closest("button")) return;
          openDetail(pageItems[index], index);
        });
      });

      document.querySelectorAll("#bug-rows select").forEach(function (dropdown) {
        dropdown.addEventListener("change", async function () {
          const id = dropdown.getAttribute("data-id");
          const newStatus = dropdown.value;

          await fetch("/api/bugs/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
          });

          loadBugs();
        });
      });

      document.querySelectorAll("#bug-rows .del-btn").forEach(function (button) {
        button.addEventListener("click", async function () {
          const id = button.getAttribute("data-id");

          await fetch("/api/bugs/" + id, {
            method: "DELETE"
          });

          showToast("Bug deleted");
          loadBugs();
        });
      });

      document.querySelectorAll("#bug-rows .arch-btn").forEach(function (button) {
        button.addEventListener("click", async function () {
          const id = button.getAttribute("data-id");

          await fetch("/api/bugs/" + id + "/archive", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true })
          });

          showToast("Bug archived");
          loadBugs();
        });
      });

      document.querySelectorAll("#bug-rows .unarch-btn").forEach(function (button) {
        button.addEventListener("click", async function () {
          const id = button.getAttribute("data-id");

          await fetch("/api/bugs/" + id + "/archive", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: false })
          });

          showToast("Bug restored");
          loadBugs();
        });
      });

      renderSourceChart(filtered);
      renderPriorityChart(filtered);
    }

    setInterval(loadBugs, 30 * 1000);
    loadBugs();
    

    document.getElementById("filter-status").addEventListener("change", function () {
      resetPage();
      exitArchivedView();
      loadBugs();
    });
    document.getElementById("filter-priority").addEventListener("change", function () {
      resetPage();
      exitArchivedView();
      loadBugs();
    });

    document.querySelectorAll(".status-pill").forEach(function (pill) {
      pill.addEventListener("click", function () {
        resetPage();
        exitArchivedView();

        const clicked = pill.getAttribute("data-status");
        const statusFilter = document.getElementById("filter-status");

        if (statusFilter.value === clicked) {
          statusFilter.value = "";
        } else {
          statusFilter.value = clicked;
        }

        document.querySelectorAll(".status-pill").forEach(function (p) {
          p.classList.remove("active");
        });
        if (statusFilter.value !== "") {
          pill.classList.add("active");
        }

        loadBugs();
      });
    });

    document.getElementById("arch-toggle").addEventListener("click", function () {
      showArchived = !showArchived;
      const btn = document.getElementById("arch-toggle");
      btn.classList.toggle("on", showArchived);
      btn.textContent = showArchived ? "Show Active" : "Show Archived";

      document.getElementById("filter-status").value = "";
      document.getElementById("filter-priority").value = "";
      document.querySelectorAll(".status-pill").forEach(function (p) {
        p.classList.remove("active");
      });

      resetPage();
      loadBugs();
    });

    document.getElementById("detail-close").addEventListener("click", function () {
      document.getElementById("detail-overlay").classList.remove("open");
    });

    document.getElementById("detail-overlay").addEventListener("click", function (e) {
      if (e.target.id === "detail-overlay") {
        document.getElementById("detail-overlay").classList.remove("open");
      }
    });

    document.getElementById("download-btn").addEventListener("click", function () {
      if (currentFiltered.length === 0) {
        showToast("Nothing to download");
        return;
      }

      const header = ["Endpoint", "Message", "Source", "Status", "Priority", "Count"];
      const lines = [header.join(",")];

      currentFiltered.forEach(function (b) {
        const row = [
          b.endpoint,
          '"' + (b.message || "").replace(/"/g, '""') + '"',
          b.source,
          b.status,
          b.priority,
          b.count
        ];
        lines.push(row.join(","));
      });

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "bugs.csv";
      a.click();

      URL.revokeObjectURL(url);
      showToast("CSV downloaded");
    });

    const modal = document.getElementById("modal");

    document.getElementById("open-modal").addEventListener("click", function () {
      modal.classList.add("open");
    });

    document.getElementById("close-modal").addEventListener("click", function () {
      modal.classList.remove("open");
    });

    document.getElementById("add-btn").addEventListener("click", async function () {
      const newBug = {
        endpoint: document.getElementById("f-endpoint").value,
        message: document.getElementById("f-message").value,
        source: document.getElementById("f-source").value,
        priority: document.getElementById("f-priority").value,
        account: document.getElementById("f-account").value
      };

      await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBug)
      });

      resetPage();
      loadBugs();
      modal.classList.remove("open");

      document.getElementById("f-endpoint").value = "";
      document.getElementById("f-message").value = "";
      document.getElementById("f-source").value = "";
      document.getElementById("f-priority").value = "";
      document.getElementById("f-account").value = "";
    });
