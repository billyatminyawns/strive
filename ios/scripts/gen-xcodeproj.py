#!/usr/bin/env python3
"""Generates Strive.xcodeproj (Xcode 16+ format, synchronized folders — new files are picked up automatically).

Re-run after changing build settings here; source files never need to be registered.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE_ID = "com.minyawns.strive"
DEPLOYMENT = "17.0"

I = {name: "5A7E" + format(n, "020X") for n, name in enumerate([
    "project", "mainGroup", "productsGroup", "appFolder", "testFolder", "appProduct", "testProduct",
    "appTarget", "testTarget", "appSources", "appFrameworks", "appResources", "testSources",
    "testFrameworks", "testResources", "projectConfigs", "appConfigs", "testConfigs", "projDebug",
    "projRelease", "appDebug", "appRelease", "testDebug", "testRelease", "proxy", "dependency", "appExceptions",
], start=1)}


def settings(d, indent=4):
    pad = "\t" * indent
    lines = []
    for k in sorted(d):
        v = d[k]
        if isinstance(v, list):
            items = "".join(f"{pad}\t{q(x)},\n" for x in v)
            lines.append(f"{pad}{k} = (\n{items}{pad});")
        else:
            lines.append(f"{pad}{k} = {q(v)};")
    return "\n".join(lines)


def q(v):
    # OpenStep plists only allow [A-Za-z0-9_./] unquoted here; anything else (spaces, $(…), leading "-") gets quoted.
    s = str(v)
    safe = s and all(c.isalnum() or c in "._/" for c in s)
    return s if safe else '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


project_common = {
    "ALWAYS_SEARCH_USER_PATHS": "NO",
    "ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS": "YES",
    "CLANG_ANALYZER_NONNULL": "YES",
    "CLANG_CXX_LANGUAGE_STANDARD": "gnu++20",
    "CLANG_ENABLE_MODULES": "YES",
    "CLANG_ENABLE_OBJC_ARC": "YES",
    "CLANG_ENABLE_OBJC_WEAK": "YES",
    "COPY_PHASE_STRIP": "NO",
    "ENABLE_STRICT_OBJC_MSGSEND": "YES",
    "ENABLE_USER_SCRIPT_SANDBOXING": "YES",
    "GCC_C_LANGUAGE_STANDARD": "gnu17",
    "GCC_NO_COMMON_BLOCKS": "YES",
    "IPHONEOS_DEPLOYMENT_TARGET": DEPLOYMENT,
    "LOCALIZATION_PREFERS_STRING_CATALOGS": "YES",
    "MTL_FAST_MATH": "YES",
    "SDKROOT": "iphoneos",
}
project_debug = {**project_common,
    "DEBUG_INFORMATION_FORMAT": "dwarf",
    "ENABLE_TESTABILITY": "YES",
    "GCC_DYNAMIC_NO_PIC": "NO",
    "GCC_OPTIMIZATION_LEVEL": "0",
    "GCC_PREPROCESSOR_DEFINITIONS": ["DEBUG=1", "$(inherited)"],
    "MTL_ENABLE_DEBUG_INFO": "INCLUDE_SOURCE",
    "ONLY_ACTIVE_ARCH": "YES",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG $(inherited)",
    "SWIFT_OPTIMIZATION_LEVEL": "-Onone",
}
project_release = {**project_common,
    "DEBUG_INFORMATION_FORMAT": "dwarf-with-dsym",
    "ENABLE_NS_ASSERTIONS": "NO",
    "MTL_ENABLE_DEBUG_INFO": "NO",
    "SWIFT_COMPILATION_MODE": "wholemodule",
    "VALIDATE_PRODUCT": "YES",
}
app = {
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_ENTITLEMENTS": "Strive/Strive.entitlements",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "DEVELOPMENT_TEAM": "",
    "ENABLE_PREVIEWS": "YES",
    "GENERATE_INFOPLIST_FILE": "YES",
    "INFOPLIST_FILE": "Strive/Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": "Strive",
    "INFOPLIST_KEY_LSApplicationCategoryType": "public.app-category.sports",
    "INFOPLIST_KEY_NSMicrophoneUsageDescription":
        "Strive uses the microphone when you record a story, a drop, or a voice note for your Coach. "
        "Nothing is saved unless you choose to save it.",
    "INFOPLIST_KEY_NSSpeechRecognitionUsageDescription":
        "Strive turns your recordings into text so your Coach can learn from what you said. "
        "Transcription happens on your iPhone when possible.",
    "INFOPLIST_KEY_UIApplicationSceneManifest_Generation": "YES",
    "INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents": "YES",
    "INFOPLIST_KEY_UIUserInterfaceStyle": "Dark",
    "LD_RUNPATH_SEARCH_PATHS": ["$(inherited)", "@executable_path/Frameworks"],
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE_ID,
    "PRODUCT_NAME": "$(TARGET_NAME)",
    "SUPPORTED_PLATFORMS": "iphoneos iphonesimulator",
    "SUPPORTS_MACCATALYST": "NO",
    "SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD": "NO",
    "SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD": "NO",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": "1",
}
tests = {
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "DEVELOPMENT_TEAM": "",
    "GENERATE_INFOPLIST_FILE": "YES",
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE_ID + ".uitests",
    "PRODUCT_NAME": "$(TARGET_NAME)",
    "SUPPORTED_PLATFORMS": "iphoneos iphonesimulator",
    "SUPPORTS_MACCATALYST": "NO",
    "SWIFT_EMIT_LOC_STRINGS": "NO",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": "1",
    "TEST_TARGET_NAME": "Strive",
}


def config(key, name, d):
    return f"""\t\t{I[key]} /* {name} */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
{settings(d)}
\t\t\t}};
\t\t\tname = {name};
\t\t}};"""


def phase(key, isa, name):
    return f"""\t\t{I[key]} /* {name} */ = {{
\t\t\tisa = {isa};
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};"""


def config_list(key, owner, debug, release):
    return f"""\t\t{I[key]} /* Build configuration list for {owner} */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{I[debug]} /* Debug */,
\t\t\t\t{I[release]} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};"""


pbx = f"""// !$*UTF8*$!
{{
\tarchiveVersion = 1;
\tclasses = {{
\t}};
\tobjectVersion = 77;
\tobjects = {{

/* Begin PBXContainerItemProxy section */
\t\t{I['proxy']} /* PBXContainerItemProxy */ = {{
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = {I['project']} /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = {I['appTarget']};
\t\t\tremoteInfo = Strive;
\t\t}};
/* End PBXContainerItemProxy section */

/* Begin PBXFileReference section */
\t\t{I['appProduct']} /* Strive.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Strive.app; sourceTree = BUILT_PRODUCTS_DIR; }};
\t\t{I['testProduct']} /* StriveUITests.xctest */ = {{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = StriveUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; }};
/* End PBXFileReference section */

/* Begin PBXFileSystemSynchronizedBuildFileExceptionSet section */
\t\t{I['appExceptions']} /* Exceptions for "Strive" folder in "Strive" target */ = {{
\t\t\tisa = PBXFileSystemSynchronizedBuildFileExceptionSet;
\t\t\tmembershipExceptions = (
\t\t\t\tInfo.plist,
\t\t\t\tStrive.entitlements,
\t\t\t);
\t\t\ttarget = {I['appTarget']} /* Strive */;
\t\t}};
/* End PBXFileSystemSynchronizedBuildFileExceptionSet section */

/* Begin PBXFileSystemSynchronizedRootGroup section */
\t\t{I['appFolder']} /* Strive */ = {{
\t\t\tisa = PBXFileSystemSynchronizedRootGroup;
\t\t\texceptions = (
\t\t\t\t{I['appExceptions']} /* Exceptions for "Strive" folder in "Strive" target */,
\t\t\t);
\t\t\tpath = Strive;
\t\t\tsourceTree = "<group>";
\t\t}};
\t\t{I['testFolder']} /* StriveUITests */ = {{
\t\t\tisa = PBXFileSystemSynchronizedRootGroup;
\t\t\tpath = StriveUITests;
\t\t\tsourceTree = "<group>";
\t\t}};
/* End PBXFileSystemSynchronizedRootGroup section */

/* Begin PBXFrameworksBuildPhase section */
{phase('appFrameworks', 'PBXFrameworksBuildPhase', 'Frameworks')}
{phase('testFrameworks', 'PBXFrameworksBuildPhase', 'Frameworks')}
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
\t\t{I['mainGroup']} = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{I['appFolder']} /* Strive */,
\t\t\t\t{I['testFolder']} /* StriveUITests */,
\t\t\t\t{I['productsGroup']} /* Products */,
\t\t\t);
\t\t\tsourceTree = "<group>";
\t\t}};
\t\t{I['productsGroup']} /* Products */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{I['appProduct']} /* Strive.app */,
\t\t\t\t{I['testProduct']} /* StriveUITests.xctest */,
\t\t\t);
\t\t\tname = Products;
\t\t\tsourceTree = "<group>";
\t\t}};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
\t\t{I['appTarget']} /* Strive */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {I['appConfigs']} /* Build configuration list for PBXNativeTarget "Strive" */;
\t\t\tbuildPhases = (
\t\t\t\t{I['appSources']} /* Sources */,
\t\t\t\t{I['appFrameworks']} /* Frameworks */,
\t\t\t\t{I['appResources']} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tfileSystemSynchronizedGroups = (
\t\t\t\t{I['appFolder']} /* Strive */,
\t\t\t);
\t\t\tname = Strive;
\t\t\tpackageProductDependencies = (
\t\t\t);
\t\t\tproductName = Strive;
\t\t\tproductReference = {I['appProduct']} /* Strive.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t}};
\t\t{I['testTarget']} /* StriveUITests */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {I['testConfigs']} /* Build configuration list for PBXNativeTarget "StriveUITests" */;
\t\t\tbuildPhases = (
\t\t\t\t{I['testSources']} /* Sources */,
\t\t\t\t{I['testFrameworks']} /* Frameworks */,
\t\t\t\t{I['testResources']} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t\t{I['dependency']} /* PBXTargetDependency */,
\t\t\t);
\t\t\tfileSystemSynchronizedGroups = (
\t\t\t\t{I['testFolder']} /* StriveUITests */,
\t\t\t);
\t\t\tname = StriveUITests;
\t\t\tpackageProductDependencies = (
\t\t\t);
\t\t\tproductName = StriveUITests;
\t\t\tproductReference = {I['testProduct']} /* StriveUITests.xctest */;
\t\t\tproductType = "com.apple.product-type.bundle.ui-testing";
\t\t}};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
\t\t{I['project']} /* Project object */ = {{
\t\t\tisa = PBXProject;
\t\t\tattributes = {{
\t\t\t\tBuildIndependentTargetsInParallel = 1;
\t\t\t\tLastSwiftUpdateCheck = 2600;
\t\t\t\tLastUpgradeCheck = 2600;
\t\t\t\tTargetAttributes = {{
\t\t\t\t\t{I['appTarget']} = {{
\t\t\t\t\t\tCreatedOnToolsVersion = 26.0;
\t\t\t\t\t}};
\t\t\t\t\t{I['testTarget']} = {{
\t\t\t\t\t\tCreatedOnToolsVersion = 26.0;
\t\t\t\t\t\tTestTargetID = {I['appTarget']};
\t\t\t\t\t}};
\t\t\t\t}};
\t\t\t}};
\t\t\tbuildConfigurationList = {I['projectConfigs']} /* Build configuration list for PBXProject "Strive" */;
\t\t\tdevelopmentRegion = en;
\t\t\thasScannedForEncodings = 0;
\t\t\tknownRegions = (
\t\t\t\ten,
\t\t\t\tBase,
\t\t\t);
\t\t\tmainGroup = {I['mainGroup']};
\t\t\tminimizedProjectReferenceProxies = 1;
\t\t\tpreferredProjectObjectVersion = 77;
\t\t\tproductRefGroup = {I['productsGroup']} /* Products */;
\t\t\tprojectDirPath = "";
\t\t\tprojectRoot = "";
\t\t\ttargets = (
\t\t\t\t{I['appTarget']} /* Strive */,
\t\t\t\t{I['testTarget']} /* StriveUITests */,
\t\t\t);
\t\t}};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
{phase('appResources', 'PBXResourcesBuildPhase', 'Resources')}
{phase('testResources', 'PBXResourcesBuildPhase', 'Resources')}
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
{phase('appSources', 'PBXSourcesBuildPhase', 'Sources')}
{phase('testSources', 'PBXSourcesBuildPhase', 'Sources')}
/* End PBXSourcesBuildPhase section */

/* Begin PBXTargetDependency section */
\t\t{I['dependency']} /* PBXTargetDependency */ = {{
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = {I['appTarget']} /* Strive */;
\t\t\ttargetProxy = {I['proxy']} /* PBXContainerItemProxy */;
\t\t}};
/* End PBXTargetDependency section */

/* Begin XCBuildConfiguration section */
{config('projDebug', 'Debug', project_debug)}
{config('projRelease', 'Release', project_release)}
{config('appDebug', 'Debug', app)}
{config('appRelease', 'Release', app)}
{config('testDebug', 'Debug', tests)}
{config('testRelease', 'Release', tests)}
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
{config_list('projectConfigs', 'PBXProject "Strive"', 'projDebug', 'projRelease')}
{config_list('appConfigs', 'PBXNativeTarget "Strive"', 'appDebug', 'appRelease')}
{config_list('testConfigs', 'PBXNativeTarget "StriveUITests"', 'testDebug', 'testRelease')}
/* End XCConfigurationList section */
\t}};
\trootObject = {I['project']} /* Project object */;
}}
"""

ref = lambda target, product: f"""<BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{I[target]}"
               BuildableName = "{product}"
               BlueprintName = "{product.split('.')[0]}"
               ReferencedContainer = "container:Strive.xcodeproj">
            </BuildableReference>"""

scheme = f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "2600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES"
      buildArchitectures = "Automatic">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            {ref('appTarget', 'Strive.app')}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES"
      shouldAutocreateTestPlan = "YES">
      <Testables>
         <TestableReference
            skipped = "NO"
            parallelizable = "NO">
            {ref('testTarget', 'StriveUITests.xctest')}
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         {ref('appTarget', 'Strive.app')}
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         {ref('appTarget', 'Strive.app')}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""

proj_dir = os.path.join(ROOT, "Strive.xcodeproj")
os.makedirs(os.path.join(proj_dir, "xcshareddata", "xcschemes"), exist_ok=True)
with open(os.path.join(proj_dir, "project.pbxproj"), "w") as f:
    f.write(pbx)
with open(os.path.join(proj_dir, "xcshareddata", "xcschemes", "Strive.xcscheme"), "w") as f:
    f.write(scheme)
print("wrote", proj_dir)
