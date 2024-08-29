// Coordinitary Structure /! Rehearse 
@Kendrah > Present

get_lib communicate
get_lib psych
get_lib wallet
get_lib wet

file_struct.allList() [{
    spot.fileType((.txt)'robot.txt') {
        role_run.tracker(".txt");
    },
    spot.fileType((.txt)'requirements.txt') {
        role_run.required(".txt");
    },
    spot.fileType((.md)'README.md') {
        read.only.instruct(".md");
    },
    spot.fileType((.appcache)'index.appcache') {
        role_run.cache(".appcache");
    },
    spot.fileType((.txt)'robot.txt') {
        role_run.tracker(".txt");
    }
    --try.runScript(allList) ++ only.([4]) {
        def.function_tracker() {
            lick.(.txt('robot.txt, requirements.txt,'));
        fuction.run(auto);
        };
    }
}];

Helpful skills • Unit testing • REST • GitHub / Git • Postman • Docker • AWS / Kubernetes