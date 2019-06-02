function describeFilterSelection() {
    let atLeastOneSelected = false;
    let allSelected = true;
    $('.filterCheckbox').each(function () {
        if ($(this).prop('checked') === true) atLeastOneSelected = true;
        else allSelected = false;
    });

    // Describe result.
    if (!atLeastOneSelected) return 'none';
    else if (allSelected) return 'all';
    else return 'some';
}

function updatePlaybackButton() {
    if (paused) $("#togglePlayback").html("Play");
    else $("#togglePlayback").html("Pause");
}

function applyFilter() {
    let filterOut = [];
    $('.filterCheckbox').each(function () {
        if (!$(this).prop('checked')) filterOut.push($(this).val());
    });

    // Don't apply a filter if no values were excluded.
    if (filterOut.length === 0) return false;

    // Apply filter!
    filters.set($('#selectFilterAttr').val(), filterOut);
    return true;
}

function removeFilterListeners() {
    // Remove event handlers assigned to temporary elements.
    $('.filterCheckbox').each(function () {
        $(this).off();
    });
    $('#applyFilter').off();
}

function removeActiveFilterListeners() {
    // Remove event handlers assigned to temporary elements.
    $('.activeFilter').each(function () {
        $(this).off();
    });
    $('.modFilter').each(function () {
        $(this).off();
    });
}
function gcol(val, max) {
    const proportion = val / max;
    return groupColorScale(proportion);
}

/*
 * Returns true if the supplied LGA name exists in the LGA name list.
 */
function exists(name) {
    for (const LGA of LGA_names)
        if (LGA === name) return true;
    return false;
}

/*
 * Cleanses and standardises LGA name inputs.
 */
function cleanse(name) {
    let result = name;

    /* Remove parentheses and underscores from LGA name. */
    result = result.replace(/[{()}]/g, '');
    result = result.replace(/[{_}]/g, ' ');
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

/* Moves a selected D3 element to the front of its parent. */
d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
        this.parentNode.appendChild(this);
    });
};

function isProportion(val) {
    switch (val) {
        case scale.ALCOHOL_RELATED:
        case scale.NO_ALCOHOLTIME:
        case scale.NO_OF_CRASHES:
        case scale.NO_RUN_OFFROAD:
            return true;
        case scale.INJURIES:
        case scale.FATALITIES:
        case scale.NO_FEMALES:
        case scale.NO_MALES:
        case scale.NO_PEDESTRIANS:
        case scale.NO_UNLICENSED:
            return false;
    }
}

function convertScale(val) {
    switch (val) {
        case scale.ALCOHOL_RELATED:
            return '# of Alcohol-Related Accidents';
        case scale.INJURIES:
            return '# of Serious & Non-serious Injuries';
        case scale.FATALITIES:
            return '# of Fatalities';
        case scale.NO_ALCOHOLTIME:
            return '# of Accidents during Alcohol Time';
        case scale.NO_FEMALES:
            return '# of Females Involved';
        case scale.NO_MALES:
            return '# of Males Involved';
        case scale.NO_OF_CRASHES:
            return '# of Accidents';
        case scale.NO_PEDESTRIANS:
            return '# of Pedestrians Involved';
        case scale.NO_RUN_OFFROAD:
            return '# of Cars Run Off-road';
        case scale.NO_UNLICENSED:
            return '# of Unlicensed Drivers Involved';
    }
}

function convertSplit(val) {
    switch (val) {
        case split.ACCIDENT_TYPE:
            return 'Type of Accident';
        case split.ALCOHOLTIME:
            return 'Happened during Alcohol Time';
        case split.DAY_OF_WEEK:
            return 'Days of The Week';
        case split.DCA_CODE:
            return 'DCA Classification Code';
        case split.HIT_RUN_FLAG:
            return 'Hit-and-Run';
        case split.LIGHT_CONDITION:
            return 'Light Conditions';
        case split.RMA_ALL:
            return 'Road Management Act Road Classification';
        case split.ROAD_GEOMETRY:
            return 'Type of Accident Location';
        case split.RUN_OFFROAD:
            return 'Car Ran Off-road';
        case split.SPEED_ZONE:
            return 'Speed Limit';
        case split.SEVERITY:
            return 'Severity of Accident';
    }
}