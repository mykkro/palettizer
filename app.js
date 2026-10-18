(() => {
  "use strict";
  const el = (id) => document.getElementById(id),
    preview = el("preview"),
    ctx = preview.getContext("2d");
  let points = PaletteMath.identity(),
    active = 1,
    source = null,
    mapped = null,
    imageName = "elevation-study",
    saved = [],
    frame = 0,
    imageRequest = 0;
  const key = "palettizer-v1-presets";
  const say = (text) => (el("status").textContent = text);
  const state = () => ({
    version: 1,
    palette: el("palette").value,
    reverse: el("reverse").checked,
    points: points.map((p) => p.slice()),
  });
  Object.entries(PALETTES).forEach(([id, p]) =>
    el("palette").add(new Option(p.name, id)),
  );
  function strip(canvas, lut) {
    const c = canvas.getContext("2d");
    for (let x = 0; x < canvas.width; x++) {
      c.fillStyle =
        "rgb(" +
        lut[Math.round((x / (canvas.width - 1)) * 255)].join(",") +
        ")";
      c.fillRect(x, 0, 1, canvas.height);
    }
  }
  function drawCurve() {
    el("remove-point").disabled = active === 0 || active === points.length - 1;
    el("add-point").disabled =
      points.length >= 32 ||
      !points.some((p, i) => i && p[0] - points[i - 1][0] >= 0.02);

    el("curve-line").setAttribute(
      "points",
      points.map(([x, y]) => 20 + x * 260 + "," + (232 - y * 220)).join(" "),
    );
    [...el("handles").children].forEach((h, i) => {
      h.setAttribute("cx", 20 + points[i][0] * 260);
      h.setAttribute("cy", 232 - points[i][1] * 220);
      h.classList.toggle("selected", i === active);
      h.setAttribute(
        "aria-label",
        "Curve point " +
          (i + 1) +
          ", input " +
          points[i][0].toFixed(2) +
          ", palette " +
          points[i][1].toFixed(2),
      );
    });
    el("point-info").textContent =
      "Point " +
      (active + 1) +
      (active === 0 || active === points.length - 1 ? " (fixed)" : "");
    for (const [id, axis] of [
      ["point-x", 0],
      ["point-y", 1],
    ]) {
      el(id).value = points[active][axis];
      el(id).disabled = active === 0 || active === points.length - 1;
      el(id + "-value").value = points[active][axis].toFixed(2);
    }
  }
  function render() {
    frame = 0;
    drawCurve();
    const colors = PALETTES[el("palette").value].colors;
    const lut = PaletteMath.lut(colors, points, el("reverse").checked);
    strip(el("base-strip"), PaletteMath.lut(colors, PaletteMath.identity()));
    strip(el("mapped-strip"), lut);
    if (!source) return;
    mapped = new ImageData(
      PaletteMath.recolor(source.data, lut),
      source.width,
      source.height,
    );
    const pixels = el("compare").checked ? source : mapped;
    preview.width = pixels.width;
    preview.height = pixels.height;
    ctx.putImageData(pixels, 0, 0);
    zoom();
  }
  // Coalesce pointer events into a single recoloring operation per display frame.
  function request() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function zoom() {
    const z = el("zoom").value;
    const viewport = el("image-viewport");
    const scale =
      z === "fit"
        ? Math.min(
            viewport.clientWidth / preview.width,
            viewport.clientHeight / preview.height,
          )
        : Number(z);
    preview.style.maxWidth = "none";
    preview.style.width = Math.max(1, Math.floor(preview.width * scale)) + "px";
    preview.style.height =
      Math.max(1, Math.floor(preview.height * scale)) + "px";
  }
  function changePoint(x, y) {
    if (active === 0 || active === points.length - 1) return;
    points[active] = [
      Math.max(
        points[active - 1][0] + 0.01,
        Math.min(points[active + 1][0] - 0.01, x),
      ),
      Math.max(points[active - 1][1], Math.min(points[active + 1][1], y)),
    ];
    request();
  }
  // Rebuild handles only when point count changes, preserving pointer capture during edits.
  function buildHandles() {
    el("handles").replaceChildren();
    for (let i = 0; i < points.length; i++) {
      const h = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      h.setAttribute("r", "6");
      h.setAttribute("class", "handle");
      h.setAttribute("tabindex", "0");
      h.setAttribute("role", "button");
      el("handles").append(h);
      h.addEventListener("focus", () => {
        active = i;
        drawCurve();
      });
      h.addEventListener("pointerdown", (e) => {
        active = i;
        h.focus();
        h.setPointerCapture(e.pointerId);
        drawCurve();
      });
      h.addEventListener("pointermove", (e) => {
        if (!h.hasPointerCapture(e.pointerId)) return;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
          el("curve").getScreenCTM().inverse(),
        );
        changePoint((p.x - 20) / 260, (232 - p.y) / 220);
      });
      h.addEventListener("pointerup", (e) => {
        if (h.hasPointerCapture(e.pointerId))
          h.releasePointerCapture(e.pointerId);
      });
      h.addEventListener("keydown", (e) => {
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        )
          return;
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : 0.005;
        changePoint(
          points[i][0] +
            (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
          points[i][1] +
            (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0),
        );
      });
    }
  }
  el("point-x").addEventListener("input", () =>
    changePoint(Number(el("point-x").value), points[active][1]),
  );
  el("point-y").addEventListener("input", () =>
    changePoint(points[active][0], Number(el("point-y").value)),
  );
  el("reset-curve").addEventListener("click", () => {
    points = PaletteMath.identity();
    active = 1;
    buildHandles();
    request();
    say("Linear mapping restored.");
  });
  ["palette", "reverse", "compare"].forEach((id) =>
    el(id).addEventListener("change", request),
  );
  el("zoom").addEventListener("change", zoom);
  // Procedural grayscale sources make the prototype useful immediately, even offline.
  function sample(kind) {
    imageRequest++;
    const width = 900,
      height = 620,
      data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const u = x / width,
          v = y / height;
        let value;
        if (kind === "ramp") value = u;
        else if (kind === "rings")
          value =
            0.5 +
            0.25 * Math.sin(Math.hypot(u - 0.3, v - 0.45) * 80) +
            0.25 * Math.cos(Math.hypot(u - 0.72, v - 0.55) * 68);
        else {
          const a = Math.exp(
              -((u - 0.35) ** 2 / 0.055 + (v - 0.45) ** 2 / 0.1),
            ),
            b =
              0.8 *
              Math.exp(-((u - 0.74) ** 2 / 0.025 + (v - 0.65) ** 2 / 0.045));
          value =
            (a + b) * 0.7 +
            0.1 *
              (Math.sin(u * 35 + Math.sin(v * 18) * 2) +
                Math.cos(v * 29 + u * 12)) +
            0.08;
          value = Math.round(Math.max(0, Math.min(1, value)) * 28) / 28;
        }
        const i = (y * width + x) * 4,
          gray = Math.round(Math.max(0, Math.min(1, value)) * 255);
        data[i] = data[i + 1] = data[i + 2] = gray;
        data[i + 3] = 255;
      }
    source = new ImageData(data, width, height);
    imageName = kind;
    el("dimensions").textContent = width + " x " + height;
    request();
    say("Generated sample. Choose a palette or reshape the curve.");
  }
  el("sample").addEventListener("change", () => {
    if (el("sample").value) sample(el("sample").value);
  });
  el("image-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ticket = ++imageRequest;
    try {
      if (file.size > 40 * 1024 * 1024)
        throw new Error("Choose an image smaller than 40 MB.");
      // Data URLs allow readback and PNG export when the app is opened from disk.
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("Could not read this file."));
        r.readAsDataURL(file);
      });
      const image = new Image();
      image.src = url;
      await image.decode();
      if (ticket !== imageRequest) return;
      const scale = Math.min(
        1,
        2048 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(image.naturalWidth * scale));
      c.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = c.getContext("2d");
      context.drawImage(image, 0, 0, c.width, c.height);
      source = context.getImageData(0, 0, c.width, c.height);
      imageName = file.name.replace(/\.[^.]+$/, "");
      el("sample").value = "";
      el("dimensions").textContent = c.width + " x " + c.height;
      request();
      say(
        file.name +
          " loaded locally." +
          (scale < 1
            ? " Resized to a maximum of 2048 pixels for this prototype."
            : ""),
      );
    } catch (error) {
      if (ticket === imageRequest)
        say("Image could not be loaded: " + error.message);
    } finally {
      e.target.value = "";
    }
  });
  function download(name, blob) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function jsonDownload(name, value) {
    download(
      name,
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
  }
  el("export-image").addEventListener("click", () => {
    render();
    if (!mapped) return;
    const c = document.createElement("canvas");
    c.width = mapped.width;
    c.height = mapped.height;
    c.getContext("2d").putImageData(mapped, 0, 0);
    c.toBlob((blob) => {
      if (blob) {
        download(imageName + "-" + el("palette").value + ".png", blob);
        say("Mapped PNG exported.");
      } else say("PNG export failed.");
    }, "image/png");
  });
  el("export-preset").addEventListener("click", () =>
    jsonDownload("palettizer-preset.json", state()),
  );
  el("export-lut").addEventListener("click", () =>
    jsonDownload("palettizer-lut.json", {
      ...state(),
      colors: PaletteMath.lut(
        PALETTES[el("palette").value].colors,
        points,
        el("reverse").checked,
      ),
    }),
  );
  function apply(value) {
    const clean = PaletteMath.validate(value, PALETTES);
    points = clean.points;
    active = Math.min(active, points.length - 1);
    buildHandles();
    el("palette").value = clean.palette;
    el("reverse").checked = clean.reverse;
    request();
  }
  el("preset-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error("Preset file is too large.");
      apply(JSON.parse(await file.text()));
      say("Preset imported. Your source image is unchanged.");
    } catch (error) {
      say("Preset not imported: " + error.message);
    } finally {
      e.target.value = "";
    }
  });
  function list() {
    el("presets").replaceChildren(new Option("Choose a preset", ""));
    saved.forEach((p, i) => el("presets").add(new Option(p.name, String(i))));
    el("delete").disabled = true;
  }
  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify(saved));
      return true;
    } catch {
      say(
        "Browser storage is unavailable. Use Export preset to keep your settings.",
      );
      return false;
    }
  }
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(raw))
      saved = raw
        .filter((p) => {
          try {
            PaletteMath.validate(p, PALETTES);
            return typeof p.name === "string" && p.name.length <= 80;
          } catch {
            return false;
          }
        })
        .slice(0, 100);
  } catch {
    say(
      "Saved presets could not be read. You can still import or export presets.",
    );
  }
  list();
  el("save").addEventListener("click", () => {
    const name = el("preset-name").value.trim();
    if (!name) {
      say("Enter a name for the preset first.");
      el("preset-name").focus();
      return;
    }
    const preset = { ...state(), name },
      i = saved.findIndex((p) => p.name === name);
    if (i >= 0) saved[i] = preset;
    else if (saved.length < 100) saved.push(preset);
    else {
      say("The 100-preset limit has been reached. Delete one first.");
      return;
    }
    list();
    if (persist()) say('Saved "' + name + '" in this browser.');
  });
  el("presets").addEventListener("change", () => {
    if (el("presets").value === "") {
      el("delete").disabled = true;
      return;
    }
    const p = saved[Number(el("presets").value)];
    apply(p);
    el("preset-name").value = p.name;
    el("delete").disabled = false;
    say('Loaded "' + p.name + '".');
  });
  el("delete").addEventListener("click", () => {
    if (el("presets").value === "") return;
    saved.splice(Number(el("presets").value), 1);
    list();
    if (persist()) say("Preset deleted.");
  });
  el("add-point").addEventListener("click", () => {
    if (points.length >= 32) return;
    // Prefer the segment following selection; otherwise split the widest available gap.
    let index = Math.min(active, points.length - 2);
    if (points[index + 1][0] - points[index][0] < 0.02) {
      index = 0;
      for (let i = 1; i < points.length - 1; i++)
        if (
          points[i + 1][0] - points[i][0] >
          points[index + 1][0] - points[index][0]
        )
          index = i;
    }
    if (points[index + 1][0] - points[index][0] < 0.02) return;
    const a = points[index],
      b = points[index + 1];
    points.splice(index + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    active = index + 1;
    buildHandles();
    request();
    say(points.length + " curve points. New point selected.");
  });
  el("remove-point").addEventListener("click", () => {
    if (active === 0 || active === points.length - 1) return;
    points.splice(active, 1);
    active = Math.min(active, points.length - 2);
    buildHandles();
    request();
    say(points.length + " curve points. Selected point removed.");
  });
  document.querySelectorAll("[data-panel]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-panel]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      document
        .querySelectorAll(".control-panel")
        .forEach((panel) => (panel.hidden = panel.id !== button.dataset.panel));
    }),
  );
  el("about-open").addEventListener("click", () => el("about").showModal());
  window.addEventListener("resize", zoom);
  new ResizeObserver(zoom).observe(el("image-viewport"));
  buildHandles();
  sample("landscape");
})();
