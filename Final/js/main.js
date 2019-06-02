"use strict";

const vis_modes = {
    AVERAGE: 'average', // Display an average of something, i.e. average total people involved per accident
    TOTAL: 'total' // Displays= a total of something, i.e. total pedestrians involved in crashes in a specific area
};

const scale = {
    ALCOHOL_RELATED: 'ALCOHOL_RELATED', // Number of alcohol-related accidents per LGA
    INJURIES: 'INJURIES', // Number of serious, non-serious, and fatal injuries in accidents per LGA
    FATALITIES: 'FATALITIES', // Number of fatal injuries in accidents per LGA
    NO_ALCOHOLTIME: 'NO_ALCOHOLTIME', // Number of accidents that occurred within the alcohol time per LGA
    NO_FEMALES: 'NO_FEMALES', // Number of females in accidents per LGA
    NO_MALES: 'NO_MALES', // Number of males in accidents per LGA
    NO_OF_CRASHES: 'NO_OF_CRASHES', // Number of records per LGA
    NO_PEDESTRIANS: 'NO_PEDESTRIANS', // Number of pedestrians involved in accidents per LGA
    NO_RUN_OFFROAD: 'NO_RUN_OFFROAD', // Number of accidents where a car was run offroad per LGA
    NO_UNLICENSED: 'NO_UNLICENSED', // Number of unlicensed drivers involved in accidents per LGA
};

/* The data can be filtered or split by these values. */
const split = {
    ACCIDENT_TYPE: 'ACCIDENT_TYPE', // Split by accident type
    ALCOHOLTIME: 'ALCOHOLTIME', // Split by alcohol time (inside or outside)
    DAY_OF_WEEK: 'DAY_OF_WEEK', // Split by days of week
    DCA_CODE: 'DCA_CODE', // Split by DCA (Definition for Classifying Accidents) code
    HIT_RUN_FLAG: 'HIT_RUN_FLAG', // Split groups by hit and run (true or false)
    LIGHT_CONDITION: 'LIGHT_CONDITION', // Group by light conditions
    RMA_ALL: 'RMA_ALL', // Group by Road Management Act classification (of road type)
    ROAD_GEOMETRY: 'ROAD_GEOMETRY', // Group by road geometry (intersection type)
    RUN_OFFROAD: 'RUN_OFFROAD', // Split groups by run offroad (yes or no)
    SPEED_ZONE: 'SPEED_ZONE', // Split into two groups based on speed limit, i.e. lower < 80km/h <= upper
    SEVERITY: 'SEVERITY', // Group by accident severity (fatality, serious, other, etc.)
};

/* Screen dimensions. */
let w, h;

/* Global data variables. */
let loaded = false;
let LGA_names = [];
let crashes;
let stats = new Map();
let threshold = 0;
let selected;
let colorScale;
let svg;
let possibleValues = new Map();

/* Playback variables. */
let paused = false;
let calculating = false;
let groupColorScale;
let colorCycleGroup;
let keepPosition = false;

/* Visualisation settings. */
let vis_mode = vis_modes.TOTAL; // Defines current visualisation mode.
let selected_scale = scale.NO_OF_CRASHES; // Defines selected scale to calculate with.
let group; //
let filters = new Map();

function init() {
    /* Setup display for a 1080p resolution. */
    w = document.body.clientWidth;
    h = document.documentElement.scrollHeight;

    /* Setup mercator projection for LGA areas. */
    let projection = d3.geoMercator().center([145.25, -36.6]).translate([w / 2, h / 2]).scale(8000 * (h / 900));
    let path = d3.geoPath().projection(projection);

    /* Create SVG canvas to draw LGA areas on. */
    const svg = d3.select("#map").append("svg").attr("width", w).attr("height", h).style("fill", "white").style("display", "none");

    // Create arrays for possible values of splittable crash record attributes.
    for (const splittable in split)
        possibleValues.set(splittable, []);

    // Setup GUI event handlers.
    setupGUI();

    // Setup a color scale to represent different group values.
    groupColorScale = d3.scaleQuantize(['#8dd3c7', '#FDE541', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5']).domain([0, 1]);

    // Detect & load in LGA (Local Government Area) names into an array.
    d3.json("https://rpg.solar/swin/pc_map_data.json?v1.0").then(function (json) {
        for (let i = 0; i < json.features.length; i++) {
            // Clean LGA names and then register them.
            const clean_LGA_name = cleanse(json.features[i].properties.LGA_name);
            LGA_names[i] = clean_LGA_name;
            json.features[i].LGA_name = clean_LGA_name;
        }

        // After doing this, load in crash records.
        d3.csv("https://rpg.solar/swin/crashes_condensed.csv?v1.1").then(function (csv) {
            // Export the data set into a global variable.
            crashes = csv;

            // Cleanse all the LGA names this one time.
            crashes.forEach(function (part, i) {
                // Cleanse all LGA names involved in this accident.
                const LGA_ALL = this[i].LGA_NAME_ALL.split(',');
                for (let j = 0; j < LGA_ALL.length; j++) {
                    LGA_ALL[j] = cleanse(LGA_ALL[j]);
                }
                this[i].LGA_NAMES = LGA_ALL;

                // Populate possible value arrays for splittable crash record attributes.
                for (const property of Object.keys(this[i])) {
                    // Skip if we are not recording all possible values for this property.
                    if (!possibleValues.has(property)) continue;

                    const propertyVal = this[i][property].split(',')[0];
                    if (propertyVal === '') continue;
                    const possiblePropertyValues = possibleValues.get(property);
                    if (!possiblePropertyValues.includes(propertyVal))
                    // This is a new unique value for this property, so add it!
                        possiblePropertyValues.push(propertyVal);
                }
            }, crashes);

            // Sort some possible values for consistency.
            for (const key of possibleValues.keys()) {
                switch (key) {
                    case split.DAY_OF_WEEK:
                        // Sort days of week Monday-Sunday.
                        const days_ordered = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                        possibleValues.get(key).sort((a, b) => {
                            return days_ordered.indexOf(a) - days_ordered.indexOf(b);
                        });
                        break;
                    case split.SPEED_ZONE:
                        const zones_ordered = ["30 km/hr", "40 km/hr", "50 km/hr", "60 km/hr", "70 km/hr", "75 km/hr", "80 km/hr", "90 km/hr", "100 km/hr", "110 km/hr", "Other speed limit", "Camping grounds or off road", "Not known"];
                        possibleValues.get(key).sort((a, b) => {
                            return zones_ordered.indexOf(a) - zones_ordered.indexOf(b);
                        });
                        break;
                }
            }

            /* Draw each individual LGA on the canvas. */
            svg.selectAll("path").data(json.features)
                .enter()
                .append("path")
                .classed("LGA_shape", true)
                .attr("d", path)
                .attr("id", function (data) {
                    return cleanse(data.properties.LGA_name);
                })
                .attr("data-toggle", 'tooltip')
                .attr('data-placement', 'top')
                .attr('title', function () {
                    return "View " + d3.select(this).attr("id")
                })
                .on('click', function () {
                    // Generate summary information when clicking on an LGA.
                    generateSummaryDialog(d3.select(this).attr('id'));
                })
                .on('mouseover', function () {
                    // When mousing over an LGA, bring it to the front so the border overlaps everything else.
                    d3.select(this).moveToFront();
                });

            /* Initialise tooltips */
            $(function () {
                $('[data-toggle="tooltip"]').tooltip();
            });

            calculate();

            /* Fade out loading icon, fade in map. */
            $('#load').fadeOut('slow', function () {
                $('svg').fadeIn('fast');
                $('#sidebar-wrapper').fadeIn('fast');
                $('#menu-toggle').fadeIn('fast');
                $('#colorLegend').fadeIn('fast');
                $('#playbackButtons').fadeIn('fast');
                $("#wrapper").toggleClass("toggled");
            });


            $("#menu-toggle").click(function (e) {
                e.preventDefault();
                $("#wrapper").toggleClass("toggled");
            });

            loaded = true;
            colorCycleTask();
        });

    });
}

function preCalculate() {
    // Show loading bar if this isn't while the page is loading.
    $('#load').removeAttr('style');
    setTimeout(calculate, 50);
}

/* Performs tallies and calculations based on current settings. */
function calculate() {
    calculating = true;
    stats.clear();

    // Reset color cycle index.
    if (!keepPosition)
        colorCycleGroup = 0;
    else keepPosition = false;

    // Record highest values for overall totals and averages.
    stats.set("range", new Map());
    stats.set("rangeavg", new Map());

    // Record highest values for grouped totals and averages.
    if (group != null) {

        stats.set("rangegroup", new Map());
        stats.set("rangegroupavg", new Map());

        for (const possible of possibleValues.get(group)) {
            stats.get("rangegroup").set(possible, new Map());
            stats.get("rangegroupavg").set(possible, new Map());
        }
    }

    // Setup stats object for each LGA.
    for (const LGA of LGA_names) {
        stats.set(LGA, {});

        // Create total and average object for each scale attribute.
        for (const attr in scale)
            stats.get(LGA)[attr] = {
                total: 0,
                average: NaN
            };

        if (group != null) {
            // Add an additional map to each attribute if there is grouping.
            const stat = stats.get(LGA);
            for (const key in stat) {
                // Check that this is a non-prototype property.
                if (stat.hasOwnProperty(key)) {
                    let map = new Map();
                    stats.get(LGA)[key]['groups'] = map;
                    // For each possible value of this attribute, give it its own total and average.
                    for (const possible of possibleValues.get(group))
                        map.set(possible, {
                            total: 0,
                            average: NaN
                        });

                    // Include object for missing cases.
                    map.set('Unknown', {total: 0});
                }
            }
        }
    }

    // Keep track of non-filtered accident cases.
    selected = 0;

    // Calculate number of crashes for each LGA.
    for (const accident of crashes) {
        // Check if this accident is filtered by the current settings.
        if (isFiltered(accident)) continue;
        selected++;

        // If a crash takes place in multiple LGAs, increment statistics for each involved LGA.
        for (const LGA of accident.LGA_NAMES) {
            for (const attr in scale) {
                switch (scale[attr]) {
                    case scale.NO_RUN_OFFROAD:
                    case scale.NO_ALCOHOLTIME:
                    case scale.ALCOHOL_RELATED:
                        if (accident.ALCOHOL_RELATED.includes('Yes'))
                            inc(accident, LGA, attr, 1);
                        break;
                    case scale.FATALITIES: {
                        const fatalities = accident.TOTAL_PERSONS - accident.SERIOUSINJURY - accident.OTHERINJURY - accident.NONINJURED;
                        inc(accident, LGA, attr, fatalities);
                        break;
                    }
                    case scale.INJURIES: {
                        const injuries = parseInt(accident.SERIOUSINJURY) + parseInt(accident.OTHERINJURY);
                        inc(accident, LGA, attr, injuries);
                        break;
                    }
                    case scale.NO_FEMALES:
                        inc(accident, LGA, attr, parseInt(accident.FEMALES));
                        break;
                    case scale.NO_MALES:
                        inc(accident, LGA, attr, parseInt(accident.MALES));
                        break;
                    case scale.NO_OF_CRASHES:
                        inc(accident, LGA, attr, 1);
                        break;
                    case scale.NO_PEDESTRIANS:
                        inc(accident, LGA, attr, parseInt(accident.PEDESTRIAN));
                        break;
                    case scale.NO_UNLICENSED:
                        inc(accident, LGA, attr, parseInt(accident.UNLICENCSED));
                        break;
                }
            }
        }
    }

    // Calculate averages for each LGA's attributes.
    for (const LGA of stats.keys()) {
        // The 'highest' and 'highestavg' keys aren't LGAs.
        if (LGA === 'range' || LGA === 'rangeavg' || LGA === 'rangegroup' || LGA === 'rangegroupavg') continue;

        // Get total amount of crashes in this LGA.
        const total = stats.get(LGA)[scale.NO_OF_CRASHES].total;
        for (const attr in scale) {
            // Calculate average amount of this attribute in this LGA.
            const data = stats.get(LGA)[attr];

            // Calculate proportion for number of crashes, otherwise calculate average for this LGA.
            if (attr === scale.NO_OF_CRASHES)
                data.average = data.total / selected;
            else data.average = data.total / total;

            // LGA's with zero accidents will produce NaN.
            if (isNaN(data.average))
                data.average = 0;

            // Check highest totals and averages since we're here.
            if (total >= threshold) {
                checkRangeTotal(attr, data.total);
                checkRangeAverage(attr, data.average);
            }
        }

        // Calculate averages for each individual group value as well. (if there is a grouping applied)
        if (group != null)
            for (const attr in scale) {

                const attrData = stats.get(LGA)[attr];
                for (const possible of possibleValues.get(group)) {
                    // Calculate the total number of cases for this singular grouped value.
                    const total = stats.get(LGA)[scale.NO_OF_CRASHES].groups.get(possible).total;

                    // Divide total by number of cases for this singular grouped value.
                    const data = attrData.groups.get(possible);
                    if (attr === scale.NO_OF_CRASHES)
                    // For number of crashes, calculate the proportion instead.
                        data.average = data.total / stats.get(LGA)[scale.NO_OF_CRASHES].total;
                    else data.average = data.total / total;

                    if (isNaN(data.average))
                        data.average = 0;

                    if (total >= threshold) {
                        checkRangeGroupTotal(attr, possible, data.total);
                        checkRangeGroupAverage(attr, possible, data.average);
                    }
                }
            }
    }

    $('#load').fadeOut('fast', function () {
        recolor();
    });

    calculating = false;
}

function inc(accident, LGA, attr, amt) {
    // Add to overall total first.
    stats.get(LGA)[attr].total += amt;

    if (group != null) {
        // Some attributes can have multiple values, so increment for each distinct value per group.
        for (const groupVal of accident[group].split(',')) {
            const stat = stats.get(LGA)[attr].groups.get(groupVal);
            if (stat === undefined)
            // Place undefined/unknown/empty values inside a separate counter.
                stats.get(LGA)[attr].groups.get('Unknown').total += 1;
            else stat.total += amt;
        }
    }
}

function checkRangeTotal(attr, val) {
    if (isNaN(val)) return;
    if (stats.get('range').has(attr)) {
        const range = stats.get('range').get(attr);
        if (val < range.lowest) range.lowest = val;
        else if (val > range.highest) range.highest = val;
    } else stats.get('range').set(attr, {
        highest: val,
        lowest: val
    });
}

function checkRangeGroupTotal(attr, groupVal, val) {
    if (isNaN(val)) return;
    if (stats.get('rangegroup').get(groupVal).has(attr)) {
        const range = stats.get('rangegroup').get(groupVal).get(attr);
        if (val < range.lowest) range.lowest = val;
        else if (val > range.highest) range.highest = val;
    } else stats.get('rangegroup').get(groupVal).set(attr, {
        highest: val,
        lowest: val
    });
}

function checkRangeAverage(attr, val) {
    if (isNaN(val)) return;
    if (stats.get('rangeavg').has(attr)) {
        const range = stats.get('rangeavg').get(attr);
        if (val < range.lowest) range.lowest = val;
        else if (val > range.highest) range.highest = val;
    } else stats.get('rangeavg').set(attr, {
        highest: val,
        lowest: val
    });
}

function checkRangeGroupAverage(attr, groupVal, val) {
    if (isNaN(val)) return;
    if (stats.get('rangegroupavg').get(groupVal).has(attr)) {
        const range = stats.get('rangegroupavg').get(groupVal).get(attr);
        if (val < range.lowest) range.lowest = val;
        else if (val > range.highest) range.highest = val;
    } else stats.get('rangegroupavg').get(groupVal).set(attr, {
        highest: val,
        lowest: val
    });
}

function recolor() {
    // Re-define color scale for currently selected scale.
    let range;
    if (group != null) {
        if (vis_mode === vis_modes.TOTAL)
            range = stats.get('rangegroup').get(possibleValues.get(group)[colorCycleGroup]).get(selected_scale);
        else if (vis_mode === vis_modes.AVERAGE)
            range = stats.get('rangegroupavg').get(possibleValues.get(group)[colorCycleGroup]).get(selected_scale);
    } else {
        if (vis_mode === vis_modes.TOTAL)
            range = stats.get('range').get(selected_scale);
        else if (vis_mode === vis_modes.AVERAGE)
            range = stats.get('rangeavg').get(selected_scale);
    }

    if (range === undefined) {
        // Sometimes the threshold can be higher than any specified number of cases.
        // If that's the case, just make the range zero.
        if (threshold > 0) {
            console.error('Threshold excluded all cases!');
            $('#noneSelected').show('slow');
            $('#thresholdTab').slideDown('fast');
        }
        range = {
            highest: 0,
            lowest: 0
        };
    } else $('#noneSelected').hide('slow');

    let maxColor = 'lawngreen';
    if (group != null) {
        maxColor = gcol(colorCycleGroup + 1, possibleValues.get(group).length);

        // Regenerate group legend.
        $('#attrColorIcon').attr('fill', maxColor);
        $('#attrDesc').html(possibleValues.get(group)[colorCycleGroup] + ' (' + (colorCycleGroup + 1) + '/' + possibleValues.get(group).length + ')');
        $('#groupName').html(convertSplit(group));
        $('#groupLegend').fadeIn("medium");
        $('#attrLegend').fadeIn("medium");
    }

    colorScale = d3.scaleLinear().range(['white', maxColor]).domain([range.lowest, range.highest]);

    /* Regenerate color scale. */
    continuous("#colorLegend", colorScale);

    d3.selectAll(".LGA_shape")
        .transition()
        .duration(1000)
        .style('fill', function () {
                const stat = stats.get(d3.select(this).attr('id'));

                if (group != null) {
                    // Display scale of current group.
                    const groupStat = stat[selected_scale].groups.get(possibleValues.get(group)[colorCycleGroup]);

                    // Show LGAs below the threshold as gray.
                    if (groupStat.total < threshold)
                        return 'gray';

                    if (vis_mode === vis_modes.TOTAL)
                        return colorScale(groupStat.total);
                    else
                        return colorScale(groupStat.average);
                } else {
                    // Show LGAs below the threshold as gray.
                    if (stat[scale.NO_OF_CRASHES].total < threshold)
                        return 'gray';

                    if (vis_mode === vis_modes.TOTAL)
                        return colorScale(stat[selected_scale].total);
                    else
                        return colorScale(stat[selected_scale].average);
                }
            }
        );
}

function colorCycleTask() {
    let repeater;
    let timeout = 20;

    function run() {
        timeout--;
        if (timeout <= 0) {
            timeout = 20;
            if (!paused && !calculating && group != null) {
                let max = possibleValues.get(group).length;
                try {
                    colorCycleGroup++;
                    // Restart cycle at beginning once done.
                    if (colorCycleGroup === max) colorCycleGroup = 0;

                    recolor();
                } catch (e) {
                    // Unfortunately, errors can occur if the user changes the stats during a recolor.
                    // All we can do is ignore and continue.
                }
            }
        }
        repeater = setTimeout(run, 50);
    }

    run();
}

function isFiltered(accident) {
    for (const filter of filters.keys())
        if (filters.get(filter).includes(accident[filter.toUpperCase()]))
            return true;
    return false;
}

function generateSummaryDialog(id) {
    if (!exists(id)) {
        /* Users shouldn't see this message if data is valid. */
        alert("Sorry, the LGA you've selected doesn't exist!");
        return;
    }

    // Set the popup's title to the selected LGA.
    $('#modalLGALabel').text('All Information for ' + id);

    let body = $('#modalLGABody');
    body.empty();
    let stat = stats.get(id);

    let name = convertScale(selected_scale);

    let percentage = ((stat.NO_OF_CRASHES.total / selected) * 100).toFixed(3);
    if (isNaN(percentage)) percentage = 0;
    body.append('<p>' + id + ' represents ' + stat.NO_OF_CRASHES.total + ' of ' + selected + ' (' + percentage + '%) selected cases.</p><hr/>');

    if (vis_mode === vis_modes.TOTAL) {
        // Display overall total for the selected scale.
        body.append('<p>Overall, the ' + name + ' was ' + stat[selected_scale].total + '.');

        if (group == null)
            body.append('<p>No grouping was applied to the dataset.</p>');
        else {
            body.append('<p>The dataset was grouped by <u>' + convertSplit(group) + '</u>:</p><ul>');
            let i = 0;
            let amtNone = 0;
            let max = possibleValues.get(group).length;
            for (const possible of possibleValues.get(group)) {
                i++;
                const total = stats.get(id)[selected_scale].groups.get(possible).total;
                if (total === 0) {
                    amtNone++;
                    continue;
                }
                body.append('<li>For <span style="color: ' + gcol(i, max) + '">' + possible + '</span>, the ' + name + ' was ' + total + '.</li>');
            }
            body.append('</ul><br/>');
            if (amtNone > 0)
                body.append('<div class="alert alert-info" role="alert">' + amtNone + ' empty variable' + (amtNone === 1 ? ' was ' : 's were') + ' not shown.</div>');
        }
    } else if (vis_mode === vis_modes.AVERAGE) {
        const isProp = isProportion(selected_scale);
        // Display average overall value for the selected scale.
        if (isProp)
            body.append('<p>Overall, the proportion of ' + name + ' for ' + id + ' in Victoria was ' + stat[selected_scale].average.toFixed(3) + '.');
        else body.append('<p>Overall, on average, the ' + name + ' was ' + stat[selected_scale].average.toFixed(3) + '.');

        if (group == null)
            body.append('<p>No grouping was applied to the dataset.</p>');
        else {
            body.append('<p>The dataset was grouped by <u>' + convertSplit(group) + '</u>:</p><ul>');
            let i = 0;
            let amtNone = 0;
            let max = possibleValues.get(group).length;
            for (const possible of possibleValues.get(group)) {
                i++;
                const avg = stats.get(id)[selected_scale].groups.get(possible).average;
                if (avg === 0) {
                    amtNone++;
                    continue;
                }
                const scaleWord = isProp ? 'proportion of ' : 'average ';
                const newName = isProp ? name.replace('# of ', '') : name;
                body.append('<li>For <span style="color: ' + gcol(i, max) + '">' + possible + '</span>, the ' + scaleWord + newName + ' was ' + avg.toFixed(3) + '.</li>');
            }
            body.append('</ul><br/>');
            if (amtNone > 0)
                body.append('<div class="alert alert-info" role="alert">' + amtNone + ' empty variable' + (amtNone === 1 ? ' was ' : 's were') + ' not shown.</div>');
        }
    }

    const amtFilt = filters.size;
    if (amtFilt === 0) {
        body.append('<p>No filters were applied to the dataset.</p>');
    } else {
        body.append('<p>There ' + (amtFilt === 1 ? 'was 1 filter' : 'was ' + amtFilt + ' filters') + ' applied to the dataset:</p><ul>');
        let i = 0;
        for (const filter of filters.keys()) {
            i++;
            let max = filters.get(filter).length;
            const amtExcluded = filters.get(filter).length;
            body.append('<li><span style="color: ' + gcol(max - i + 1, max) + '">' + convertSplit(filter) + '</span>, excluding ' + amtExcluded + (amtExcluded === 1 ? ' value.' : ' values.') + '</li>')
        }
        body.append('</ul>');
    }

    if (stats.get(id)[scale.NO_OF_CRASHES].total < threshold)
        body.append('<div class="alert alert-warning" role="alert">This LGA does not appear on the colour scale due to falling below the specified minimum case count.</div>');

    $('#modalLGA').modal('show');
}


/* Call init() when the window loads. */
$(function () {
    init()
});
