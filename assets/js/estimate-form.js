(function () {
  var config = window.BERRIOS_ESTIMATE || {};
  var SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  var token = "";
  var widgetId = null;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function show(form, kind, message) {
    var done = form.parentElement.querySelector(".w-form-done");
    var fail = form.parentElement.querySelector(".w-form-fail");
    if (done) done.style.display = kind === "done" ? "block" : "none";
    if (fail) {
      fail.style.display = kind === "fail" ? "block" : "none";
      if (kind === "fail" && message) {
        var text = fail.querySelector("div");
        if (text) text.textContent = message;
      }
    }
    form.style.display = kind === "done" ? "none" : "";
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("Failed to load verification.")); };
      document.head.appendChild(script);
    });
  }

  ready(function () {
    var form = document.getElementById("email-form");
    if (!form) return;
    if (form.getAttribute("data-estimate") === "paused") {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
      form.querySelectorAll("input, textarea, button").forEach(function (field) {
        field.disabled = true;
      });
      return;
    }

    var recaptcha = form.querySelector(".g-recaptcha");
    if (recaptcha) recaptcha.remove();

    var slot = document.createElement("div");
    slot.id = "estimate-turnstile";
    var submit = form.querySelector('[type="submit"]');
    form.insertBefore(slot, submit);

    loadTurnstile()
      .then(function () {
        if (!config.turnstileSiteKey || !window.turnstile) return;
        widgetId = window.turnstile.render(slot, {
          sitekey: config.turnstileSiteKey,
          appearance: "interaction-only",
          "response-field": false,
          callback: function (value) { token = value; },
          "expired-callback": function () { token = ""; },
          "error-callback": function () { token = ""; },
        });
      })
      .catch(function (error) {
        console.error(error);
      });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      var done = form.parentElement.querySelector(".w-form-done");
      var fail = form.parentElement.querySelector(".w-form-fail");
      if (done) done.style.display = "none";
      if (fail) fail.style.display = "none";

      if (!config.endpoint) {
        show(form, "fail", "This form is not connected yet. Email berriostreesvc@gmail.com or call (210) 409-0076.");
        return;
      }

      var button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;

      function field(name) {
        var el = form.elements.namedItem(name);
        return el && "value" in el ? el.value : "";
      }

      var body = {
        name: field("name"),
        email: field("email"),
        phone: field("Phone"),
        description: field("Description"),
        turnstileToken: token,
      };

      fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (response) {
          return response.json().catch(function () { return null; }).then(function (result) {
            if (!response.ok) throw new Error((result && result.error) || "Something went wrong. Please try again.");
            show(form, "done");
            form.reset();
            token = "";
            if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
          });
        })
        .catch(function (error) {
          show(form, "fail", error instanceof Error ? error.message : "Something went wrong. Please try again.");
        })
        .finally(function () {
          if (button) button.disabled = false;
        });
    }, true);
  });
})();
