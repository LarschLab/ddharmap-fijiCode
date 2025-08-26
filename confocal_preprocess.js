// Fiji / ImageJ (JavaScript) script
// Save each channel of a 3‑channel 8‑bit z‑stack to .nrrd with a custom naming scheme.
//
// Naming format per channel:
//   [fishID]_round[roundNumber]_channel[channelNumber]_[targetGene].nrrd
//
// --- USER SETTINGS ---------------------------------------------------------
var fishID = "YOUR_FISH_ID";              // e.g., "m38"
var roundNumber = 1;                       // e.g., 1
// Ordered list of target genes per channel index (1-based):
var targetGenes = ["geneC1", "geneC2", "geneC3"]; // length should match number of channels
// ---------------------------------------------------------------------------

// Java imports
importClass(Packages.ij.IJ);
importClass(Packages.ij.io.DirectoryChooser);
importClass(Packages.ij.plugin.Duplicator);

// ---- Helpers --------------------------------------------------------------
function detectNrrdCommandKey() {
  var cmds = Packages.ij.Menus.getCommands();
  // Debug: list all commands containing 'Nrrd'
  var keys = cmds.keySet().toArray();
  var foundList = [];
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i]);
    if (k.toLowerCase().indexOf("nrrd") >= 0) {
      foundList.push(k);
    }
  }
  IJ.log("[DBG] Commands containing 'Nrrd': " +
         (foundList.length ? foundList.join(" | ") : "<none>"));

  // First try some common variants
  var candidates = ["Nrrd ...", "Nrrd...", "Nrrd", "Nrrd Save..."];
  for (var j = 0; j < candidates.length; j++) {
    if (cmds.containsKey(candidates[j])) {
      return candidates[j];
    }
  }

  // Otherwise return the first match we found
  if (foundList.length > 0) {
    return foundList[0];
  }
  return null;
}


// Suppress NRRD file dialog by feeding options via Macro.setOptions, then verify file exists
function saveAsNrrd_NoDialogs(imp, outPath, nrrdCmdKey) {
  importClass(Packages.ij.Macro);
  importClass(Packages.java.io.File);
  importClass(Packages.java.lang.System);

  var optionPatterns = [
    function(p){ return "save=[" + p + "]"; },
    function(p){ return "path=[" + p + "]"; },
    function(p){ return "file=[" + p + "]"; },
    function(p){ return "output=[" + p + "]"; }
  ];

  for (var i = 0; i < optionPatterns.length; i++) {
    var opt = optionPatterns[i](outPath);
    try {
      IJ.log("[DBG] Trying NRRD save via '" + nrrdCmdKey + "' with options: " + opt);
      Macro.setOptions(opt);          // next IJ.run reads these options
      var t0 = System.currentTimeMillis();
      IJ.run(imp, nrrdCmdKey, "");   // run headless; plugin should not open a dialog
      var t1 = System.currentTimeMillis();
      Macro.setOptions(null);         // clear
      IJ.log("[DBG] IJ.run returned in " + (t1 - t0) + " ms");

      var f = new java.io.File(outPath);
      if (f.exists() && f.length() > 0) {
        IJ.log("[DBG] Verified file exists (" + f.length() + " bytes): " + outPath);
        return true;
      } else {
        IJ.log("[DBG] After run, file does not exist yet: " + outPath);
      }
    } catch (e) {
      Macro.setOptions(null);
      IJ.log("[DBG] Exception during NRRD save with options '" + opt + "': " + e);
    }
  }
  return false;
}
  }
  return false;
}

(function main() {
  var imp = IJ.getImage();
  if (imp == null) {
    IJ.error("No image open.");
    return;
  }

  var nrrdKey = detectNrrdCommandKey();
  if (nrrdKey == null) {
    IJ.error(
    "Could not find an installed NRRD writer command." 
    +
    "I looked for any command containing 'Nrrd' in Fiji's command map." 
    +
    "Please ensure File > Save As > Nrrd ... exists."
  );
    return;
  }
  IJ.log("Using NRRD command key: '" + nrrdKey + "'");

  var nC = imp.getNChannels();
  var nZ = imp.getNSlices();
  var nT = imp.getNFrames();
  var isHyper = imp.isHyperStack();
  var bitDepth = imp.getBitDepth();

  if (bitDepth !== 8) {
    IJ.log("WARNING: Detected bit depth " + bitDepth + ". This script expects an 8-bit stack.");
  }

  if (nC < 1) {
    IJ.error("Image has no channels.");
    return;
  }

  if (targetGenes.length < nC) {
    IJ.error("targetGenes list (length=" + targetGenes.length + ") is shorter than number of channels (" + nC + ").\nUpdate targetGenes to match your channels.");
    return;
  }

  if (!isHyper && (nC > 1)) {
    IJ.log("Input is not a HyperStack; attempting to proceed using channel range duplication.");
  }

  var dc = new DirectoryChooser("Choose output folder for .nrrd files");
  var outDir = dc.getDirectory();
  if (outDir == null) {
    IJ.error("No output directory selected. Aborting.");
    return;
  }

  if (!outDir.match(/\/$/)) outDir = outDir + "/";

  for (var c = 1; c <= nC; c++) {
    var gene = targetGenes[c - 1];
    var baseName = fishID + "_round" + roundNumber + "_channel" + c + "_" + gene;
    var outPath = outDir + baseName + ".nrrd";

    IJ.log("Processing channel " + c + ", gene=" + gene + ", outPath=" + outPath);

    var dup = new Duplicator().run(imp, c, c, 1, nZ, 1, Math.max(1, nT));
    if (dup == null) {
      IJ.error("Failed to duplicate channel " + c + ".");
      return;
    }

    dup.setTitle(baseName);
    dup.show();
    IJ.log("Duplicated and showing: " + baseName);

    var ok = saveAsNrrd_NoDialogs(dup, outPath, nrrdKey);
    IJ.log("saveAsNrrd_NoDialogs returned: " + ok);

    dup.close();

    if (!ok) {
      IJ.error(
        "NRRD save failed without dialogs. Your NRRD plugin may require specific option names." 
        +
        "Turn on Plugins > Macros > Record..., save one image via File > Save As > Nrrd ..., and paste the recorded command/options so I can wire them in." 
        +
        "Attempted path: " + outPath
      );
      return;
    }

    IJ.log("Saved (attempted): " + outPath);
  }

  IJ.showStatus("Done: Saved " + nC + " channel(s) to NRRD in " + outDir);
})();
