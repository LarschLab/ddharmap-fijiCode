// 16-bit interleaved-channel splitter (interleaving across T) with:
// 1) safe duplication of the input
// 2) resize to 750x750 (with calibration updated)
// 3) optional horizontal flip (X) and Z flip
//
// Assumptions: input hyperstack is C=1, Z=1, T>=2 (channels interleaved across time)

importClass(Packages.ij.IJ);
importClass(Packages.ij.ImagePlus);
importClass(Packages.ij.ImageStack);
importClass(Packages.ij.measure.Calibration);
importClass(Packages.ij.process.ImageProcessor);
importClass(Packages.ij.process.ShortProcessor);
importClass(Packages.ij.process.ByteProcessor);

// -------------------- options --------------------
var duplicateInput = true;   // don't touch the original
var targetW = 750, targetH = 750; // registration working size
var flipX = true;            // mirror left-right
var flipZ = true;            // reverse slice order (Z)
// -------------------------------------------------

// Get source and make a working copy
var srcImp = IJ.getImage();
var imp = duplicateInput ? srcImp.duplicate() : srcImp;
if (duplicateInput) imp.setTitle(srcImp.getTitle() + " [dup]");

// Dimensional checks
var nC = imp.getNChannels();
var nZ = imp.getNSlices();
var nT = imp.getNFrames();
var bitDepth = imp.getBitDepth();
var w0 = imp.getWidth(), h0 = imp.getHeight();
IJ.log("Detected: C=" + nC + " Z=" + nZ + " T=" + nT + " bit=" + bitDepth + " size=" + w0 + "x" + h0);
if (nC != 1 || nZ != 1 || nT < 2) {
  IJ.error("Expected C=1, Z=1, T>=2 (interleaved channels across time).");
  throw "Wrong dimensionality";
}
if (!(bitDepth == 16 || bitDepth == 8)) {
  IJ.error("Only 16-bit or 8-bit images supported.");
  throw "Unsupported bit depth";
}

// Helpers
function scaledCalibration(srcImp, newW, newH) {
  // Preserve physical FOV after resizing by scaling pixel size
  var s = srcImp.getCalibration();
  var c = new Calibration(srcImp);
  var sx = srcImp.getWidth()  / newW;
  var sy = srcImp.getHeight() / newH;
  c.pixelWidth  = s.pixelWidth  * sx;
  c.pixelHeight = s.pixelHeight * sy;
  c.pixelDepth  = s.pixelDepth; // unchanged (no Z resampling)
  c.setUnit(s.getUnit());
  c.xOrigin = s.xOrigin; c.yOrigin = s.yOrigin; c.zOrigin = s.zOrigin;
  c.frameInterval = s.frameInterval;
  c.setTimeUnit(s.getTimeUnit());
  return c;
}

function makeOutImp(name, st, cal, infoStr) {
  var out = new ImagePlus(name, st);
  out.setDimensions(1, st.getSize(), 1); // C=1, Z=depth, T=1
  out.setOpenAsHyperStack(true);
  out.setCalibration(cal);
  if (infoStr != null) out.setProperty("Info", infoStr);
  return out;
}

function flipStackHoriz(st) {
  var w = st.getWidth(), h = st.getHeight(), n = st.getSize();
  for (var s = 1; s <= n; s++) {
    var pix = st.getPixels(s); // short[] or byte[]
    for (var y = 0; y < h; y++) {
      var L = y * w, R = L + w - 1;
      while (L < R) {
        var tmp = pix[L]; pix[L] = pix[R]; pix[R] = tmp; L++; R--;
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

// Prepare output stacks at target size
var needResize = (w0 != targetW) || (h0 != targetH);
var outW = targetW, outH = targetH;
var greenStack = new ImageStack(outW, outH);
var redStack   = new ImageStack(outW, outH);

// Split (even T -> Green, odd T -> Red), resizing each frame to 750x750
var srcStack = imp.getStack();
for (var t = 0; t < nT; t++) {
  var idx = imp.getStackIndex(1, 1, t + 1); // C=1, Z=1, T=t+1
  var srcPix = srcStack.getPixels(idx);

  // Build an ImageProcessor for this frame
  var ip;
  if (bitDepth == 16) ip = new ShortProcessor(w0, h0, srcPix, null);
  else                ip = new ByteProcessor (w0, h0, srcPix, null);

  ip.setInterpolationMethod(ImageProcessor.BILINEAR);
  var rp = needResize ? ip.resize(outW, outH) : ip.duplicate(); // ensure separate buffer
  var dstPix = rp.getPixels();

  if ((t & 1) === 0) greenStack.addSlice(null, dstPix);
  else               redStack.addSlice(null,  dstPix);
}

// Build ImagePlus with proper calibration + metadata (scaled if resized)
var info = srcImp.getProperty("Info");
var outCal = scaledCalibration(imp, outW, outH);

var greenImp = makeOutImp("Green", greenStack, outCal, info);
var redImp   = makeOutImp("Red",   redStack,   outCal, info);

// Free working duplicate if we made one (original stays open, untouched)
if (duplicateInput) imp.close();

// Apply flips on outputs
if (flipX) { flipStackHoriz(greenImp.getStack()); flipStackHoriz(redImp.getStack()); }
if (flipZ) { greenImp.setStack(reversedStack(greenImp.getStack()));
             redImp.setStack(reversedStack(redImp.getStack())); }

// Optional LUTs for visualization only (data remain 16-bit)
// IJ.run(greenImp, "Green", ""); IJ.run(redImp, "Red", "");

// Show results
greenImp.show();
redImp.show();
