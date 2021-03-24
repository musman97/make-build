const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const prompt = require("prompt");
const { upload } = require("diawi-nodejs-uploader");
const { exec } = require("child_process");

dotenv.config();

const projectNames = fs
    .readdirSync(process.env.WORKSPACE_DIR_PATH)
    .filter(
        (dir) =>
            !["OtherProjectsRelatedStuff", "make-build", ".DS_Store"].includes(
                dir
            )
    );

projectNames.forEach((projectName, index) => {
    console.log(`Press ${index + 1} to make apk for Project [${projectName}]`);
});
console.log("Press 0 to exit");

const schema = {
    properties: {
        projectNumber: {
            description: "Enter The Project Number",
            message: "Invalid Project Number",
            required: true,
            conform: function (value) {
                if (value < 0) {
                    return false;
                }
                if (value > projectNames.length) {
                    return false;
                }
                return true;
            },
        },
    },
};

prompt.get(schema, (error, result) => {
    if (error) {
        console.error("Oops an error occured");
        process.exit(1);
    }
    if (result.projectNumber === 0) {
        return;
    }

    const index = result.projectNumber - 1;
    const projectName = projectNames[index];
    const projectDir = path.join(process.env.WORKSPACE_DIR_PATH, projectName);
    const makeDebugApkCmd =
        "npx react-native bundle --dev false --platform android --entry-file index.js --bundle-output ./android/app/src/main/assets/index.android.bundle --assets-dest ./android/app/src/main/res \
         && cd android && ./gradlew clean && ./gradlew assembleDebug \
        && cd ..";
    const cmd = `current_dir=$pwd;cd ${projectDir};${makeDebugApkCmd};cd $current_dir`;

    const cp = exec(cmd, {
        cwd: projectDir,
        env: process.env,
        shell: true,
    });
    cp.stdout.on("data", (data) => {
        console.log(data.toString("utf8"));
    });
    cp.stderr.on("data", (data) => {
        console.log("Error in making APK");
        console.log(data.toString("utf8"));
    });
    cp.on("exit", (code) => {
        if (code === 0) {
            const pathToApk = path.join(
                projectDir,
                "android/app/build/outputs/apk/debug/app-debug.apk"
            );
            upload(
                {
                    token: process.env.DIAWI_API_KEY,
                    file: pathToApk,
                },
                {
                    onStatusProgress: (status) => {
                        let message = "";
                        if (status === 2001) {
                            message =
                                "Processing, please try again in a few seconds...";
                        } else if (status === 2000) {
                            message = "Successfully Uploaded";
                        }
                        console.log("Status of Apk: ", message);
                    },
                    onUploadProgress: (progress) => {
                        console.log("Uploading Apk: " + progress);
                    },
                }
            );
        }
    });
});
