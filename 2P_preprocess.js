// 16-bit interleaved-channel splitter (interleaving across T), with optional flips.
// Assumptions: C=1, Z=1, T=n; input is 16-bit (8-bit also supported, but kept as-is).
// Run via: Plugins > New > Script (Language: JavaScript)

importClass(Packages.ij.IJ);
importClass(Packages.ij.ImagePlus);
importClass(Packages.ij.ImageStack);
importClass(Packages.ij.measure.Calibration);

// -------------------- options --------------------
var flipX = true;   // mirror left-right
var flipZ = true;   // reverse slice order (Z)
// -------------------------------------------------

var imp = IJ.getImage();
var width  = imp.getWidth();
var height = imp.getHeight();
var nC = imp.getNChannels();
var nZ = imp.getNSlices();
var nT = imp.getNFrames();
var bitDepth = imp.getBitDepth();

IJ.log("Detected stack: C=" + nC + ", Z=" + nZ + ", T=" + nT + ", bitDepth=" + bitDepth);
if (nC != 1 || nZ != 1 || nT < 2) {
  IJ.error("Expected C=1, Z=1, T>=2 (interleaved channels across time).");
  throw "Wrong dimensionality";
}

// Build output stacks; we reuse the original pixel arrays (no conversion)
var greenStack = new ImageStack(width, height);
var redStack   = new ImageStack(width, height);

// Split frames: even -> Green, odd -> Red (0-based t)
var srcStack = imp.getStack();
for (var t = 0; t < nT; t++) {
  var idx = imp.getStackIndex(1, 1, t + 1); // C=1, Z=1, T=t+1
  var pixels = srcStack.getPixels(idx);     // short[] for 16-bit; byte[] if 8-bit
  if ((t & 1) === 0) greenStack.addSlice(null, pixels);
  else               redStack.addSlice(null, pixels);
}

// Clone calibration & metadata
function cloneCalibration(srcImp) {
  var s = srcImp.getCalibration();
  var c = new Calibration(srcImp);
  c.pixelWidth  = s.pixelWidth;
  c.pixelHeight = s.pixelHeight;
  c.pixelDepth  = s.pixelDepth;
  c.setUnit(s.getUnit());
  c.xOrigin = s.xOrigin; c.yOrigin = s.yOrigin; c.zOrigin = s.zOrigin;
  c.frameInterval = s.frameInterval;
  c.setTimeUnit(s.getTimeUnit());
  return c;
}
var info = imp.getProperty("Info");

function makeImp(name, st) {
  var out = new ImagePlus(name, st);
  out.setDimensions(1, st.getSize(), 1); // C=1, Z=depth, T=1
  out.setOpenAsHyperStack(true);
  out.setCalibration(cloneCalibration(imp));
  if (info != null) out.setProperty("Info", info);
  return out;
}

var greenImp = makeImp("Green", greenStack);
var redImp   = makeImp("Red",   redStack);

// Free source before flips to save RAM
// imp.close();

// ---- flips ----
// Works for both 16-bit (short[]) and 8-bit (byte[]) pixel arrays.
function flipStackHoriz(st) {
  var w = st.getWidth(), h = st.getHeight(), n = st.getSize();
  for (var s = 1; s <= n; s++) {
    var pix = st.getPixels(s); // short[] or byte[]
    for (var y = 0; y < h; y++) {
      var L = y * w, R = L + w - 1;
      while (L < R) {
        var tmp = pix[L]; pix[L] = pix[R]; pix[R] = tmp;
        L++; R--;
      }
    }
  }
}

function reversedStack(st) {
  var n = st.getSize(), w = st.getWidth(), h = st.getHeight();
  var out = new ImageStack(w, h);
  for (var s = n; s >= 1; s--) out.addSlice(st.getSliceLabel(s), st.getPixels(s));
  return out;
}

if (flipX) { flipStackHoriz(greenImp.getStack()); flipStackHoriz(redImp.getStack()); }
if (flipZ) { greenImp.setStack(reversedStack(greenImp.getStack()));
             redImp.setStack(reversedStack(redImp.getStack())); }

// Optional: set display LUTs (doesn't alter data type/intensities)
// IJ.run(greenImp, "Green", ""); IJ.run(redImp, "Red", "");

// Show final images (16-bit)
greenImp.show();
redImp.show();
