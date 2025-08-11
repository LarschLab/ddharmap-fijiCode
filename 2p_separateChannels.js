// Code separates channels; frame 1 as green, frame 2 as red.
// Assumptions: C = 1, Z = 1, T = n; 8-bit input

importClass(Packages.ij.ImagePlus);
importClass(Packages.ij.ImageStack);
importClass(Packages.ij.IJ);

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

// Create new ImagePlus from output stacks
if (greenStack.getSize() > 0) {
    var greenImp = new ImagePlus("Green", greenStack);
    greenImp.setDimensions(1, greenStack.getSize(), 1);  // C=1, Z=depth, T=1
    greenImp.setOpenAsHyperStack(true);
    greenImp.show();
} else {
    IJ.log("Green stack is empty!");
}

if (redStack.getSize() > 0) {
    var redImp = new ImagePlus("Red", redStack);
    redImp.setDimensions(1, redStack.getSize(), 1);
    redImp.setOpenAsHyperStack(true);
    redImp.show();
} else {
    IJ.log("Red stack is empty!");
}

// Close original
//imp.close();
