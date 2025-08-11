// Code separates channels; frame 1 as green, frame 2 as red.
// Assumptions: C = 1, Z = 1, T = n; 8-bit input

importClass(Packages.ij.ImagePlus);
importClass(Packages.ij.ImageStack);
importClass(Packages.ij.IJ);
importClass(Packages.ij.measure.Calibration);   // <-- add

var imp = IJ.getImage();
var stack = imp.getStack();
var width = imp.getWidth();
var height = imp.getHeight();
var nFrames = imp.getNFrames();
var nSlices = imp.getNSlices();
var nChannels = imp.getNChannels();

IJ.log("Detected stack: C=" + nChannels + ", Z=" + nSlices + ", T=" + nFrames);

if (nChannels != 1 || nSlices != 1) {
    IJ.error("Expected a 1-channel, 1-slice per frame hyperstack (interleaved in T).");
    exit();
}

// Prepare output stacks
var greenStack = new ImageStack(width, height);
var redStack = new ImageStack(width, height);

// Loop through frames (T)
for (var t = 0; t < nFrames; t++) {
    var index = imp.getStackIndex(1, 1, t + 1);  // C=1, Z=1, T=t+1
    var pixels = stack.getPixels(index);
    if (t % 2 == 0) {
        greenStack.addSlice(null, pixels);
    } else {
        redStack.addSlice(null, pixels);
    }
}

// Helper: clone spatial calibration from source
function cloneCalibration(srcImp) {
    var src = srcImp.getCalibration();
    var c = new Calibration(srcImp);
    c.pixelWidth  = src.pixelWidth;
    c.pixelHeight = src.pixelHeight;
    c.pixelDepth  = src.pixelDepth;     // your "Voxel depth 2"
    c.setUnit(src.getUnit());           // e.g., "micron"
    c.xOrigin = src.xOrigin; c.yOrigin = src.yOrigin; c.zOrigin = src.zOrigin;
    // Keep time metadata too (not used when T=1, but harmless to preserve)
    c.frameInterval = src.frameInterval;
    c.setTimeUnit(src.getTimeUnit());
    return c;
}

// Create new ImagePlus from output stacks and apply calibration & metadata
var srcCal = cloneCalibration(imp);
var info = imp.getProperty("Info"); // Bio-Formats/OME text metadata if present

if (greenStack.getSize() > 0) {
    var greenImp = new ImagePlus("Green", greenStack);
    greenImp.setDimensions(1, greenStack.getSize(), 1);  // C=1, Z=depth, T=1
    greenImp.setOpenAsHyperStack(true);
    greenImp.setCalibration(srcCal);                      // <-- preserve pixel size/units
    if (info != null) greenImp.setProperty("Info", info); // <-- optional: copy text metadata
    // Optional: set a green LUT for visualization
    // IJ.run(greenImp, "Green", "");
    greenImp.show();
} else {
    IJ.log("Green stack is empty!");
}

if (redStack.getSize() > 0) {
    var redImp = new ImagePlus("Red", redStack);
    redImp.setDimensions(1, redStack.getSize(), 1);
    redImp.setOpenAsHyperStack(true);
    redImp.setCalibration(cloneCalibration(imp));         // separate instance of calibration
    if (info != null) redImp.setProperty("Info", info);
    // Optional: set a red LUT
    // IJ.run(redImp, "Red", "");
    redImp.show();
} else {
    IJ.log("Red stack is empty!");
}

// Close original if you want to free RAM
// imp.close();
