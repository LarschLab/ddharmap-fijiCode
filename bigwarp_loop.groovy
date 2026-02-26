// -------------------------------------------------------------
// Batch apply BigWarp landmarks into 2P anatomical space
// Hardcoded paths version
// -------------------------------------------------------------

import java.io.File
import java.io.IOException
import bdv.ij.ApplyBigwarpPlugin
import bdv.gui.TransformTypeSelectDialog
import bdv.viewer.Interpolation
import bigwarp.landmarks.LandmarkTableModel
import ij.IJ
import ij.ImagePlus
import ij.io.FileSaver

// ---------------- HARD CODED PATHS ----------------

def inputFolder  = new File("/Users/ddharmap/dataProcessing/bigwarp_test/input")
def outputFolder = new File("/Users/ddharmap/dataProcessing/bigwarp_test/output")

def landmarksFile = new File("/Volumes/jlarsch/default/D2c/07_Data/Matilde/Microscopy/L396_f03/02_reg/00_preprocessing/rbest/L396_f03_round1_channel1_GCaMP_landmarks.csv")

def targetFile = new File("/Volumes/jlarsch/default/D2c/07_Data/Matilde/Microscopy/L396_f03/02_reg/00_preprocessing/2p_anatomy/L396_f03_anatomy_2P_GCaMP.nrrd")

int nThreads = 4
boolean isVirtual = false   // MUST stay false for saving

// --------------------------------------------------

// Create output folder if needed
if (!outputFolder.exists()) outputFolder.mkdirs()

// Open target (fixed) image
ImagePlus targetIp = IJ.openImage(targetFile.getAbsolutePath())
if (targetIp == null)
    throw new RuntimeException("Could not open target image.")

int nd = (targetIp.getNSlices() > 1) ? 3 : 2

// Load landmarks
def ltm = new LandmarkTableModel(nd)
try {
    ltm.load(landmarksFile)
} catch (IOException e) {
    throw new RuntimeException("Failed to load landmarks CSV.")
}

// Helper: detect label files by filename
boolean isLabelFile(String nameLower) {
    return nameLower.contains("label") ||
           nameLower.contains("mask") ||
           nameLower.contains("seg") ||
           nameLower.contains("cellpose")
}

// Helper: remove extension, including .nii.gz
String stripExtension(String filename) {
    String lower = filename.toLowerCase()
    if (lower.endsWith(".nii.gz"))
        return filename.substring(0, filename.length() - 7)
    int dot = filename.lastIndexOf('.')
    return (dot > 0) ? filename.substring(0, dot) : filename
}

// Helper: save stacks as stack TIFF, single planes as regular TIFF
boolean saveAsTiffAuto(ImagePlus ip, File outFile) {
    def saver = new FileSaver(ip)
    if (ip.getStackSize() > 1)
        return saver.saveAsTiffStack(outFile.getAbsolutePath())
    return saver.saveAsTiff(outFile.getAbsolutePath())
}

// Supported extensions
def exts = [".tif", ".tiff", ".nrrd", ".nii", ".nii.gz"] as Set

File[] files = inputFolder.listFiles()
if (files == null)
    throw new RuntimeException("Input folder empty or unreadable.")

for (File f : files) {

    if (!f.isFile()) continue

    String nameLower = f.getName().toLowerCase()
    if (!exts.any { nameLower.endsWith(it) }) continue

    IJ.log("Processing: " + f.getName())

    ImagePlus movingIp = IJ.openImage(f.getAbsolutePath())
    if (movingIp == null) {
        IJ.log("  Could not open. Skipping.")
        continue
    }

    // Choose interpolation
    Interpolation interp = isLabelFile(nameLower) ?
            Interpolation.NEARESTNEIGHBOR :
            Interpolation.NLINEAR

    // Apply transform into Target space
    def warpedList = ApplyBigwarpPlugin.apply(
            movingIp,
            targetIp,
            ltm,
            TransformTypeSelectDialog.TPS,
            ApplyBigwarpPlugin.TARGET,
            "",
            ApplyBigwarpPlugin.TARGET,
            null, null, null,
            interp,
            isVirtual,
            true,
            nThreads
    )

    if (warpedList == null || warpedList.isEmpty()) {
        IJ.log("  Transform failed.")
        movingIp.close()
        continue
    }

    // Save output(s)
    def baseName = stripExtension(f.getName())
    if (warpedList.size() == 1) {
        ImagePlus warpedIp = warpedList.get(0)
        if (warpedIp == null) {
            IJ.log("  Transform failed: null output image.")
            movingIp.close()
            continue
        }
        def outFile = new File(outputFolder, baseName + "__to2P.tif")
        if (!saveAsTiffAuto(warpedIp, outFile))
            IJ.log("  Save failed: " + outFile.getAbsolutePath())
        warpedIp.close()
    } else {
        IJ.log("  Multiple warped outputs: " + warpedList.size())
        for (int i = 0; i < warpedList.size(); i++) {
            ImagePlus warpedIp = warpedList.get(i)
            if (warpedIp == null) {
                IJ.log("  Output " + (i + 1) + " is null. Skipping.")
                continue
            }
            String outName = String.format("%s__to2P_%02d.tif", baseName, i + 1)
            def outFile = new File(outputFolder, outName)
            if (!saveAsTiffAuto(warpedIp, outFile))
                IJ.log("  Save failed: " + outFile.getAbsolutePath())
            warpedIp.close()
        }
    }

    movingIp.close()
}

targetIp.close()

IJ.log("DONE.")
