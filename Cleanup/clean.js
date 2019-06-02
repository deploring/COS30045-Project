let LGA_list = [];

function init() {
    d3.json("https://rpg.solar/swin/map_data.json?v1.0").then(function (json) {
        for (let i = 0; i < json.features.length; i++) {
            LGA_list[i] = cleanse(json.features[i].properties.LGA_name);
        }

        /* Load crash data -after- the JSON data has been loaded. */
        /* D3 tasks run async, meaning they do not block execution. */
        d3.csv("https://rpg.solar/swin/crashes_condensed.csv?v1.0").then(function (csv) {
            let total = 0;
            for (const accident of csv) {
                const LGA_all = accident.LGA_NAME_ALL;
                const LGA = cleanse(LGA_all.split(',')[0]);
                total++;

                if (!exists(LGA))
                    console.log('The LGA ' + LGA + ' doesn\'t exist @ crash record #' + total);
            }
            console.log('Loaded in ' + total + ' crashes!');

            /* Update HTML page after operation. */
            d3.selectAll('#load').text("").append("u").text("The operation is complete!");
            d3.selectAll('#status').append("p").text("There were " + total + ' valid records detected. (' + csv.length + ' overall)');
        });
    });
}

/*
 * Returns true if the supplied LGA name exists in the LGA name list.
 */
function exists(name) {
    for (const LGA of LGA_list)
        if (LGA === name) return true;
    return false;
}

/*
 * Cleanses and standardises LGA name inputs.
 */
function cleanse(name) {
    let result = name;

    /* Remove parentheses from LGA name. */
    result = result.replace(/[{()}]/g, '');
    /* Remove unwanted keyword from alpine resort areas. */
    result = result.replace(' Alpine Resort', '');
    result = result.replace(' Uninc', '');
    /* Format name in title case. */
    result = titleCase(result);

    return result;
}

/*
 * Capitalizes the first letter of a word.
 */
function capitalizeFirstLetter(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/*
 * Converts a string to title case.
 * (capitalizes the first letter of each word)
 */
function titleCase(string) {
    return string.toLowerCase().split(/[\-\s]/).map(x => capitalizeFirstLetter(x)).join(" ");
}

window.onload = init;
