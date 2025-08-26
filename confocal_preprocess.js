// Fiji / ImageJ (JavaScript) script
// Save each channel of a 3-channel 8-bit z-stack to .nrrd with a custom naming scheme.
// [fishID]_round[roundNumber]_channel[channelNumber]_[targetGene].nrrd

// --- USER SETTINGS ---------------------------------------------------------
var fishID = "L331_f01";
var roundNumber = 1;
// Ordered list of target genes per channel index (1-based):
var targetGenes = ["GCaMP", "sst1_1", "pth2"]; // must match #channels
// ---------------------------------------------------------------------------

// Java imports
importClass(Packages.ij.IJ);
importClass(Packages.ij.io.DirectoryChooser);
importClass(Packages.ij.plugin.Duplicator);

// ---- Helpers --------------------------------------------------------------

// Find the exact internal command key for "File > Save As > Nrrd ..."
function detectNrrdCommandKey() {
  var cmds = Packages.ij.Menus.getCommands();
  var keys = cmds.keySet().toArray();
  var foundList = [];
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i]);
    if (k.toLowerCase().indexOf("nrrd") >= 0) {
      foundList.push(k);
    }
  }
  IJ.log("[DBG] Commands containing 'Nrrd': " + (foundList.length ? foundList.join(" | ") : "<none>"));

  var candidates = ["Nrrd ... ", "Nrrd...", "Nrrd", "Nrrd Save..."];
  for (var j = 0; j < candidates.length; j++) {
    if (cmds.containsKey(candidates[j])) {
      return candidates[j];
    }
  }
  if (foundList.length > 0) return foundList[0];
  return null;
}

// Suppress NRRD file dialog by feeding options via Macro.setOptions,
// then verify that the output file was actually created.
// Try many option formats + both IJ.run forms (with & without imp)
function saveAsNrrd_NoDialogs(imp, outPath, nrrdCmdKey) {
  importClass(Packages.ij.Macro);
  importClass(Packages.java.io.File);
  importClass(Packages.java.lang.System);

  // Build a battery of option strings to try
  var p = outPath;
  var q = "\"" + outPath + "\"";  // double-quoted
  var s = "'" + outPath + "'";    // single-quoted

  var tokens = [
    "save=" + p,      "save=[" + p + "]",      "save=" + q,      "save=" + s,
    "path=" + p,      "path=[" + p + "]",      "path=" + q,      "path=" + s,
    "file=" + p,      "file=[" + p + "]",      "file=" + q,      "file=" + s,
    "output=" + p,    "output=[" + p + "]",    "output=" + q,    "output=" + s
  ];

  function fileOk() {
    var f = new java.io.File(outPath);
    return f.exists() && f.length() > 0;
  }

  // Variant A: run bound to the duplicate image window
  for (var i = 0; i < tokens.length; i++) {
    var opt = tokens[i];
    try {
      IJ.log("[DBG] A) IJ.run(imp,'" + nrrdCmdKey + "', opt): " + opt);
      Macro.setOptions(opt);
      var t0 = System.currentTimeMillis();
      IJ.run(imp, nrrdCmdKey, "");                // empty arg; options via Macro.setOptions
      var dt = System.currentTimeMillis() - t0;
      Macro.setOptions(null);

      if (fileOk()) {
        IJ.log("[DBG]   ✔ wrote file via A) in " + dt + " ms: " + outPath);
        return true;
      } else {
        IJ.log("[DBG]   ✖ no file from A) (dt=" + dt + " ms).");
      }
    } catch (eA) {
      Macro.setOptions(null);
      IJ.log("[DBG]   EXC A) " + eA);
    }
  }

  // Variant B: run as a global command (some plugins only look at global options)
  for (var j = 0; j < tokens.length; j++) {
    var opt2 = tokens[j];
    try {
      IJ.log("[DBG] B) IJ.run('" + nrrdCmdKey + "', opt): " + opt2);
      Macro.setOptions(opt2);
      var t1 = System.currentTimeMillis();
      IJ.run(nrrdCmdKey, "");                     // no imp; options via Macro.setOptions
      var dt2 = System.currentTimeMillis() - t1;
      Macro.setOptions(null);

      if (fileOk()) {
        IJ.log("[DBG]   ✔ wrote file via B) in " + dt2 + " ms: " + outPath);
        return true;
      } else {
        IJ.log("[DBG]   ✖ no file from B) (dt=" + dt2 + " ms).");
      }
    } catch (eB) {
      Macro.setOptions(null);
      IJ.log("[DBG]   EXC B) " + eB);
    }
  }

  return false;
}


// ---- Main -----------------------------------------------------------------
(function main() {
  var imp = IJ.getImage();
  if (imp == null) {
    IJ.error("No image open.");
    return;
  }

  // Resolve the exact NRRD command key installed in THIS Fiji
  var nrrdKey = detectNrrdCommandKey();
  if (nrrdKey == null) {
    IJ.error(
      "Could not find an installed NRRD writer command.\n" +
      "I looked for any command containing 'Nrrd' in Fiji's command map.\n" +
      "Please ensure File > Save As > Nrrd ... exists."
    );
    return;
  }
  IJ.log("Using NRRD command key: '" + nrrdKey + "'");

  // Basic checks
  var nC = imp.getNChannels();
  var nZ = imp.getNSlices();
  var nT = imp.getNFrames();
  var isHyper = imp.isHyperStack();
  var bitDepth = imp.getBitDepth();

  IJ.log("[DBG] Image C/Z/T/bitDepth = " + [nC, nZ, nT, bitDepth].join("/"));
  if (bitDepth !== 8) {
    IJ.log("WARNING: Detected bit depth " + bitDepth + ". This script expects an 8-bit stack.");
  }
  if (nC < 1) {
    IJ.error("Image has no channels.");
    return;
  }
  if (targetGenes.length < nC) {
    IJ.error(
      "targetGenes list (length=" + targetGenes.length + ") is shorter than number of channels (" + nC + ").\n" +
      "Update targetGenes to match your channels."
    );
    return;
  }
  if (!isHyper && (nC > 1)) {
    IJ.log("Input is not a HyperStack; attempting to proceed using channel range duplication.");
  }

  // Choose an output directory once; we will provide full paths to the plugin
  var dc = new DirectoryChooser("Choose output folder for .nrrd files");
  var outDir = dc.getDirectory();
  if (outDir == null) {
    IJ.error("No output directory selected. Aborting.");
    return;
  }
  if (!outDir.match(/\/$/)) outDir = outDir + "/";
  IJ.log("[DBG] Output directory: " + outDir);

  // Loop channels (1-based indexing in ImageJ hyperstacks)
  for (var c = 1; c <= nC; c++) {
    var gene = targetGenes[c - 1];
    var baseName = fishID + "_round" + roundNumber + "_channel" + c + "_" + gene;
    var outPath = outDir + baseName + ".nrrd";

    IJ.log("[DBG] Processing channel " + c + " -> " + baseName);

    // Duplicate the current channel across all Z/T
    var dup = new Duplicator().run(imp, c, c, 1, nZ, 1, Math.max(1, nT));
    if (dup == null) {
      IJ.error("Failed to duplicate channel " + c + ".");
      return;
    }
    dup.setTitle(baseName);
    dup.show();

    var ok = saveAsNrrd_NoDialogs(dup, outPath, nrrdKey);
    dup.close();

    if (!ok) {
      IJ.error(
        "NRRD save failed without dialogs.\n" +
        "Your NRRD plugin may require specific option names.\n" +
        "Turn on Plugins > Macros > Record..., save one image via File > Save As > Nrrd ..., and paste the recorded command/options so I can wire them in.\n" +
        "Attempted path: " + outPath
      );
      return;
    }

    IJ.log("Saved (verified): " + outPath);
  }

  IJ.showStatus("Done: Saved " + nC + " channel(s) to NRRD in " + outDir);
})();
