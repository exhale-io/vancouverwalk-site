mapboxgl.accessToken = config.mapboxToken;

const ANIMATION_MS = 3000;
const CITIES = [
  "Burnaby",
  "Coquitlam",
  "Delta",
  "Maple Ridge",
  "New Westminster",
  "North Vancouver",
  "Pitt Meadows",
  "Port Coquitlam",
  "Port Moody",
  "Richmond",
  "Surrey",
  "UBC",
  "Vancouver",
  "West Vancouver",
];

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/outdoors-v12",
  center: [-122.9805, 49.2488],
  zoom: window.innerWidth < 768 ? 9 : 10.5,
  attributionControl: false,
});

const modal = document.getElementById("about-modal");
const modalBody = document.querySelector(".modal-body");
const aboutLink = document.getElementById("about-link");
const aboutPage1 = document.getElementById("about-page-1");
const aboutPage2 = document.getElementById("about-page-2");
const closeBtn = document.querySelector(".close");
const walkStats = document.getElementById("walk-stats");
const routeName = document.getElementById("route-name");
const filterLink = document.getElementById("filter-link");
const filterPanel = document.getElementById("filter-panel");
const filterClear = document.getElementById("filter-clear");
const noResults = document.getElementById("no-results");
const cityCheckboxes = document.getElementById("city-checkboxes");

const yearRangeMin = document.getElementById("year-range-min");
const yearRangeMax = document.getElementById("year-range-max");
const distRangeMin = document.getElementById("dist-range-min");
const distRangeMax = document.getElementById("dist-range-max");
const yearLabelMin = document.getElementById("year-label-min");
const yearLabelMax = document.getElementById("year-label-max");
const distLabelMin = document.getElementById("dist-label-min");
const distLabelMax = document.getElementById("dist-label-max");

// Set header height CSS variable for filter panel positioning
const header = document.querySelector(".header-container");
document.documentElement.style.setProperty(
  "--header-height",
  header.offsetHeight + "px",
);

// Build city checkboxes
CITIES.forEach((city) => {
  const label = document.createElement("label");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.value = city;
  label.append(cb, city);
  cityCheckboxes.appendChild(label);
});

// Filter panel toggle
function closeFilterPanel() {
  filterPanel.classList.remove("open");
  filterLink.classList.remove("active");
}

filterLink.addEventListener("click", (e) => {
  e.preventDefault();
  if (filterPanel.classList.contains("open")) {
    closeFilterPanel();
  } else {
    filterPanel.classList.add("open");
    filterLink.classList.add("active");
  }
});

// About modal
aboutLink.addEventListener("click", (event) => {
  event.preventDefault();
  modal.classList.add("show");
  aboutLink.classList.add("active");
  aboutPage1.style.display = "block";
  aboutPage2.style.display = "none";
  document.body.classList.add("modal-open");
});

function closeModal() {
  modal.classList.remove("show");
  aboutLink.classList.remove("active");
  document.body.classList.remove("modal-open");
}

closeBtn.addEventListener("click", (event) => {
  closeModal();
  event.stopPropagation();
});

window.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

let stepsChart = null;
let statsRendered = false;

function animateCounter(el, target, duration) {
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(eased * target).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderStats(features) {
  if (statsRendered) {
    animateCounter(document.getElementById("hours-number"), totalHours, 2000);
    return;
  }
  statsRendered = true;

  const sorted = [...features].sort((a, b) =>
    a.properties.date.localeCompare(b.properties.date),
  );

  let cumSteps = 0;
  const labels = [];
  const data = [];
  let totalH = 0;
  sorted.forEach((f) => {
    cumSteps += Math.round((f.properties.distance_km * 1000) / 0.762);
    totalH += f.properties.duration_hours || 0;
    labels.push(f.properties.date);
    data.push(cumSteps);
  });

  totalHours = Math.round(totalH);
  const millions = (cumSteps / 1_000_000).toFixed(1);
  document.getElementById("steps-title").textContent =
    `${millions} Million Footprints Left Behind`;

  const ctx = document.getElementById("steps-chart").getContext("2d");
  stepsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data,
          fill: true,
          backgroundColor: "rgba(252, 76, 2, 0.25)",
          borderColor: "#FC4C02",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          type: "category",
          ticks: {
            autoSkip: true,
            maxRotation: 0,
            callback: function (val, i) {
              const year = labels[i].slice(0, 4);
              if (i === 0 || labels[i - 1].slice(0, 4) !== year) return year;
              return null;
            },
            font: { family: "Raleway", size: 11 },
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            callback: (v) => (v / 1_000_000).toFixed(1) + "M",
            font: { family: "Raleway", size: 11 },
          },
          grid: { color: "rgba(0,0,0,0.06)" },
        },
      },
      animation: { duration: 800, easing: "easeOutQuart" },
    },
  });

  animateCounter(document.getElementById("hours-number"), totalHours, 2000);
}

let totalHours = 0;
let allFeatures = [];

modalBody.addEventListener("click", () => {
  if (aboutPage1.style.display === "none") {
    aboutPage1.style.display = "block";
    aboutPage2.style.display = "none";
  } else {
    aboutPage1.style.display = "none";
    aboutPage2.style.display = "block";
    if (allFeatures.length) renderStats(allFeatures);
  }
});

// Walk names are "YYYY Walk N" — parse to a numeric sort key
function walkSortKey(name) {
  const m = name.match(/^(\d{4}) Walk (\d+)$/);
  return m ? parseInt(m[1]) * 1000 + parseInt(m[2]) : 0;
}

function walkInfo(feature) {
  const km = feature.properties.distance_km;
  return `Walk ${feature.id + 1}` + (km ? ` \u00B7 ${Math.round(km)}km` : "");
}

map.on("load", () => {
  Promise.all([
    fetch("data/routes.json").then((r) => r.json()),
    fetch("data/municipalities.geojson").then((r) => r.json()),
  ])
    .then(([data, muniData]) => {
      const sorted = [...data.features].sort(
        (a, b) =>
          walkSortKey(a.properties.name) - walkSortKey(b.properties.name),
      );
      sorted.forEach((feature, index) => {
        feature.id = index;
        feature.properties.order = index;
      });

      function computeStats(features) {
        const totalKm = features.reduce(
          (sum, f) => sum + (f.properties.distance_km || 0),
          0,
        );
        return totalKm > 0
          ? `${features.length} walks \u00B7 ${Math.round(totalKm)} km`
          : `${features.length} walks`;
      }

      const defaultStats = computeStats(sorted);
      walkStats.textContent = defaultStats;
      allFeatures = sorted;

      map.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: sorted },
      });

      // Municipality polygons
      map.addSource("municipalities", {
        type: "geojson",
        data: muniData,
      });

      map.addLayer({
        id: "municipalities-fill",
        type: "fill",
        source: "municipalities",
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0.08,
        },
        filter: ["==", ["get", "name"], ""],
      });

      map.addLayer({
        id: "municipalities-outline",
        type: "line",
        source: "municipalities",
        paint: {
          "line-color": "#000000",
          "line-width": 1.5,
          "line-opacity": 0.4,
        },
        filter: ["==", ["get", "name"], ""],
      });

      const FADE_STEPS = 8;

      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        filter: ["<=", ["get", "order"], -1],
        layout: {
          "line-join": "round",
          "line-cap": "round",
          "line-sort-key": ["literal", 0],
        },
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#000000",
            "#FC4C02",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            ["case", ["boolean", ["feature-state", "hover"], false], 5, 3],
            15,
            ["case", ["boolean", ["feature-state", "hover"], false], 27, 25],
            20,
            ["case", ["boolean", ["feature-state", "hover"], false], 47, 45],
          ],
          // Opacity controlled by setPaintProperty for both intro and filter animations
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.7,
            0.7,
          ],
        },
      });

      const animStart = performance.now();
      let introAnimDone = false;

      function animate(now) {
        const progress = ((now - animStart) / ANIMATION_MS) * sorted.length;

        map.setFilter("routes", ["<=", ["get", "order"], progress]);
        map.setPaintProperty("routes", "line-opacity", [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.7,
          ["<", ["get", "order"], progress - FADE_STEPS],
          0.7,
          [
            "interpolate",
            ["linear"],
            ["-", progress, ["get", "order"]],
            0,
            0,
            FADE_STEPS,
            0.7,
          ],
        ]);

        if (progress < sorted.length + FADE_STEPS) {
          requestAnimationFrame(animate);
        } else {
          introAnimDone = true;
          map.setFilter("routes", null);
          map.setPaintProperty("routes", "line-opacity", [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.7,
            0.7,
          ]);
        }
      }
      requestAnimationFrame(animate);

      // Filtering
      let visibleFeatures = sorted;
      let filterActive = false;
      let currentMatchingIds = new Set(sorted.map((f) => f.id));
      let filterAnimId = null;
      const FILTER_FADE_MS = 900;

      function getFilterValues() {
        const yearMin = Math.round(+yearRangeMin.value);
        const yearMax = Math.round(+yearRangeMax.value);
        const distMin = +distRangeMin.value;
        const distMax = +distRangeMax.value;
        const selectedCities = [
          ...cityCheckboxes.querySelectorAll("input:checked"),
        ].map((cb) => cb.value);
        return { yearMin, yearMax, distMin, distMax, selectedCities };
      }

      function animateFilter(newMatchingIds) {
        if (filterAnimId) cancelAnimationFrame(filterAnimId);

        const fadingOut = [...currentMatchingIds].filter(
          (id) => !newMatchingIds.has(id),
        );
        const fadingIn = [...newMatchingIds].filter(
          (id) => !currentMatchingIds.has(id),
        );
        const staying = [...newMatchingIds].filter((id) =>
          currentMatchingIds.has(id),
        );

        currentMatchingIds = newMatchingIds;
        const start = performance.now();

        function step(now) {
          const t = Math.min((now - start) / FILTER_FADE_MS, 1);
          const fadeOutOpacity = 0.7 * (1 - t);
          const fadeInOpacity = 0.7 * t;

          map.setPaintProperty("routes", "line-opacity", [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.7,
            ["in", ["get", "order"], ["literal", staying]],
            0.7,
            ["in", ["get", "order"], ["literal", fadingIn]],
            fadeInOpacity,
            ["in", ["get", "order"], ["literal", fadingOut]],
            fadeOutOpacity,
            0,
          ]);

          if (t < 1) {
            filterAnimId = requestAnimationFrame(step);
          } else {
            filterAnimId = null;
            // Final state: just show matching at full opacity
            map.setPaintProperty("routes", "line-opacity", [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.7,
              ["in", ["get", "order"], ["literal", [...newMatchingIds]]],
              0.7,
              0,
            ]);
          }
        }

        filterAnimId = requestAnimationFrame(step);
      }

      function applyFilter() {
        if (!introAnimDone) return;

        const { yearMin, yearMax, distMin, distMax, selectedCities } =
          getFilterValues();

        // Update labels
        yearLabelMin.textContent = yearMin;
        yearLabelMax.textContent = yearMax;
        distLabelMin.textContent = distMin + " km";
        distLabelMax.textContent = distMax + " km";

        const isDefault =
          yearMin === 2023 &&
          yearMax === 2026 &&
          distMin === 5 &&
          distMax === 30 &&
          selectedCities.length === 0;

        // Determine which features match the filter
        const matchingIds = new Set();
        sorted.forEach((f) => {
          if (isDefault) {
            matchingIds.add(f.id);
            return;
          }
          const p = f.properties;
          const year = +p.date.slice(0, 4);
          const dist = p.distance_km || 0;
          const cities = p.cities || [];

          if (year < yearMin || year > yearMax) return;
          if (dist < distMin || dist > distMax) return;
          if (
            selectedCities.length > 0 &&
            !selectedCities.some((c) => cities.includes(c))
          )
            return;
          matchingIds.add(f.id);
        });

        filterActive = !isDefault;
        animateFilter(matchingIds);

        visibleFeatures = sorted.filter((f) => matchingIds.has(f.id));

        if (visibleFeatures.length === 0) {
          noResults.classList.add("show");
          walkStats.textContent = "0 walks";
        } else {
          noResults.classList.remove("show");
          walkStats.textContent = computeStats(visibleFeatures);
        }

        // Show municipality polygons for selected cities
        if (selectedCities.length > 0) {
          map.setFilter("municipalities-fill", [
            "in",
            ["get", "name"],
            ["literal", selectedCities],
          ]);
          map.setFilter("municipalities-outline", [
            "in",
            ["get", "name"],
            ["literal", selectedCities],
          ]);
        } else {
          map.setFilter("municipalities-fill", ["==", ["get", "name"], ""]);
          map.setFilter("municipalities-outline", ["==", ["get", "name"], ""]);
        }
      }

      function resetFilters() {
        yearRangeMin.value = 2023;
        yearRangeMax.value = 2026;
        distRangeMin.value = 5;
        distRangeMax.value = 30;
        cityCheckboxes
          .querySelectorAll("input")
          .forEach((cb) => (cb.checked = false));
        applyFilter();
      }

      // Dual-handle slider enforcement + live filter
      // Use "change" (fires on release) so the fade animation plays fully
      function syncSlider(rangeMin, rangeMax) {
        rangeMin.addEventListener("input", () => {
          if (+rangeMin.value > +rangeMax.value)
            rangeMin.value = rangeMax.value;
          // Update labels live while dragging
          yearLabelMin.textContent = Math.round(+yearRangeMin.value);
          yearLabelMax.textContent = Math.round(+yearRangeMax.value);
          distLabelMin.textContent = +distRangeMin.value + " km";
          distLabelMax.textContent = +distRangeMax.value + " km";
        });
        rangeMax.addEventListener("input", () => {
          if (+rangeMax.value < +rangeMin.value)
            rangeMax.value = rangeMin.value;
          yearLabelMin.textContent = Math.round(+yearRangeMin.value);
          yearLabelMax.textContent = Math.round(+yearRangeMax.value);
          distLabelMin.textContent = +distRangeMin.value + " km";
          distLabelMax.textContent = +distRangeMax.value + " km";
        });
        rangeMin.addEventListener("change", applyFilter);
        rangeMax.addEventListener("change", applyFilter);
      }

      syncSlider(yearRangeMin, yearRangeMax);
      syncSlider(distRangeMin, distRangeMax);

      // Live filter on checkbox change
      cityCheckboxes.addEventListener("change", applyFilter);

      filterClear.addEventListener("click", resetFilters);

      // Click map to close filter panel
      map.on("click", (e) => {
        if (filterPanel.classList.contains("open")) {
          closeFilterPanel();
        }

        if (
          !map.queryRenderedFeatures(e.point, { layers: ["routes"] }).length
        ) {
          routeName.textContent = "";
          walkStats.textContent = filterActive
            ? computeStats(visibleFeatures)
            : defaultStats;
        }
      });

      // Hover and click interactions
      let hoveredRouteId = null;

      map.on("mousemove", "routes", (e) => {
        if (e.features.length > 0) {
          const featureId = e.features[0].id;
          // Ignore hidden (filtered-out) routes
          if (!currentMatchingIds.has(featureId)) {
            if (hoveredRouteId !== null) {
              map.setFeatureState(
                { source: "routes", id: hoveredRouteId },
                { hover: false },
              );
              map.setLayoutProperty("routes", "line-sort-key", ["literal", 0]);
              hoveredRouteId = null;
            }
            map.getCanvas().style.cursor = "";
            routeName.textContent = "";
            return;
          }
          if (hoveredRouteId !== null) {
            map.setFeatureState(
              { source: "routes", id: hoveredRouteId },
              { hover: false },
            );
          }
          hoveredRouteId = featureId;
          map.setFeatureState(
            { source: "routes", id: hoveredRouteId },
            { hover: true },
          );
          map.setLayoutProperty("routes", "line-sort-key", [
            "case",
            ["==", ["id"], hoveredRouteId],
            1,
            0,
          ]);
          map.getCanvas().style.cursor = "pointer";
          routeName.textContent = walkInfo(e.features[0]);
        }
      });

      map.on("mouseleave", "routes", () => {
        if (hoveredRouteId !== null) {
          map.setFeatureState(
            { source: "routes", id: hoveredRouteId },
            { hover: false },
          );
          map.setLayoutProperty("routes", "line-sort-key", ["literal", 0]);
          hoveredRouteId = null;
        }
        map.getCanvas().style.cursor = "";
        routeName.textContent = "";
      });

      map.on("click", "routes", (e) => {
        const info = walkInfo(e.features[0]);
        if (window.innerWidth < 768) walkStats.textContent = info;
        else routeName.textContent = info;
      });
    })
    .catch((error) => console.error("Error loading routes:", error));
});
