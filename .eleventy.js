module.exports = function (eleventyConfig) {
  // Static assets copied through untouched.
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/favicon.png");
  eleventyConfig.addPassthroughCopy("src/apple-touch-icon.png");
  eleventyConfig.addPassthroughCopy("src/og-image.png");
  eleventyConfig.addPassthroughCopy("src/og-image.svg");

  // Watch the stylesheet/script during `npm start`.
  eleventyConfig.addWatchTarget("src/css/");
  eleventyConfig.addWatchTarget("src/js/");

  // Clickable contact details with prewritten messages.
  // Usage (always end with | safe):
  //   {{ site.email                  | mailto | safe }}              -> enquiry template
  //   {{ site.grievanceEmail         | mailto("grievance") | safe }} -> grievance template
  //   {{ site.privacyEmail           | mailto("privacy")  | safe }}  -> data-request template
  //   {{ site.phone                  | whatsapp | safe }}            -> enquiry message
  //   {{ site.complianceOfficer.phone| whatsapp("grievance") | safe }}
  var FIRM = "RURR Advisors";
  var MAIL_TEMPLATES = {
    enquiry: {
      subject: "Enquiry — " + FIRM,
      body: "Hi " + FIRM + ",\n\nName:\nPhone:\nI'm interested in:\n\nMy question / what I'm looking for:\n\nThank you."
    },
    grievance: {
      subject: "Grievance / Complaint — " + FIRM,
      body: "Hi " + FIRM + ",\n\nName:\nRegistered email:\nPhone:\nTicket number (if any):\nNature of complaint:\n\nDetails of the complaint:\n\nThank you."
    },
    privacy: {
      subject: "Data protection request — " + FIRM,
      body: "Hi " + FIRM + ",\n\nName:\nRequest type (access / correction / erasure / withdraw consent):\n\nDetails:\n\nThank you."
    }
  };
  var WA_TEMPLATES = {
    enquiry: "Hi " + FIRM + ", I found you via your website and would like to know more about your investment advisory services.",
    grievance: "Hi " + FIRM + ", I would like to raise a grievance. My ticket number (if any) is: "
  };

  eleventyConfig.addFilter("mailto", function (v, ctx) {
    var t = MAIL_TEMPLATES[ctx] || MAIL_TEMPLATES.enquiry;
    var href = "mailto:" + v + "?subject=" + encodeURIComponent(t.subject) + "&amp;body=" + encodeURIComponent(t.body);
    return '<a class="lnk" href="' + href + '">' + v + "</a>";
  });
  eleventyConfig.addFilter("whatsapp", function (v, ctx) {
    var num = String(v).replace(/[^\d]/g, ""); // wa.me needs digits only, incl. country code
    var text = WA_TEMPLATES[ctx] || WA_TEMPLATES.enquiry;
    var href = "https://wa.me/" + num + "?text=" + encodeURIComponent(text);
    return '<a class="lnk" href="' + href + '" target="_blank" rel="noopener">' + v + "</a>";
  });
  eleventyConfig.addFilter("weblink", function (v) {
    var href = /^https?:\/\//.test(v) ? v : "https://" + v;
    return '<a class="lnk" href="' + href + '" target="_blank" rel="noopener">' + v + "</a>";
  });

  // Human date for article cards/headers, e.g. {{ post.data.date | readableDate }}
  eleventyConfig.addFilter("readableDate", function (d) {
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return "";
    var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return dt.getUTCDate() + " " + m[dt.getUTCMonth()] + " " + dt.getUTCFullYear();
  });
  // Sortable timestamp for the resources filter, e.g. data-ts="{{ post.data.date | epoch }}"
  eleventyConfig.addFilter("epoch", function (d) {
    var t = d instanceof Date ? d : new Date(d);
    return isNaN(t.getTime()) ? 0 : t.getTime();
  });
  // Unique, sorted list of article categories for the topic filter chips
  eleventyConfig.addFilter("topics", function (posts) {
    var seen = {};
    (posts || []).forEach(function (p) {
      var c = p.data && p.data.category;
      if (c) seen[c] = true;
    });
    return Object.keys(seen).sort();
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
