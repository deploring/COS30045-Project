function setupGUI() {
    /* Setup menu togglers. */
    $('#toggle-attributes').on('click', function () {
        $('#attributes').slideToggle();
    });
    $('#toggle-filters').on('click', function () {
        $('#filterTab').slideToggle();
    });
    $('#toggle-grouping').on('click', function () {
        $('#groupingTab').slideToggle();
    });
    $('#toggle-threshold').on('click', function () {
        $('#thresholdTab').slideToggle();
    });
    $('#toggle-chart').on('click', function () {
        $('#chartTab').slideToggle();
    });

    $('#createHistogram').on('click', function () {
        if (group != null)
            groupedHistogram();
        else ungroupedHistogram();
    });

    /* Setup handlers for visualisation modes. */
    $('#calculateAsAverages').on('click', function () {
        if (vis_mode === vis_modes.TOTAL) {
            vis_mode = vis_modes.AVERAGE;
            recolor();
        }
    });
    $('#calculateAsTotals').on('click', function () {
        if (vis_mode === vis_modes.AVERAGE) {
            vis_mode = vis_modes.TOTAL;
            recolor();
        }
    });

    /* Remove validation message when typing new input. */
    $('#thresholdInput').on('input', function () {
        $('#thresholdTab').removeClass('was-validated');
    });

    $('#applyThreshold').on('click', function () {
        $('#thresholdTab').removeClass('was-validated');

        const input = parseInt($('#thresholdInput').val());
        $('#thresholdInput').val('');

        // Input must be a number.
        if (isNaN(input) || input < 0 || input > 3000)
            $('#thresholdTab').addClass('was-validated');
        else {
            threshold = input;
            keepPosition = true;
            preCalculate();
        }
    });

    /* Append supported scale values to dropdown list. */
    for (const attr in scale)
        if (attr !== scale.NO_OF_CRASHES)
            $('#selectScale').append(new Option(convertScale(attr), attr));

    /* Setup handler for scale selection. */
    $('#selectScale').on('change', function () {
        selected_scale = scale[$(this).val()];
        recolor()
    });

    /* Setup handler for filter selection. */
    $('#selectFilterAttr').on('change', function () {
        // Hide validation message.
        $('#filterTab').removeClass('was-validated');
        $('#groupingTab').removeClass('was-validated');

        const val = $(this).val();

        switch (val) {
            case '':
                removeFilterListeners();
                $('#filterValueSelection').empty();
                break;
            default:
                createFilterSelection(split[val], false);
                break;
        }
    });

    /* Setup handler for grouping selection. */
    $('#selectGroupAttr').on('change', function () {
        // Hide validation message.
        $('#groupingTab').removeClass('was-validated');
        $('#filterTab').removeClass('was-validated');

        const val = $(this).val();
        switch (val) {
            case '':
                group = null;
                preCalculate();
                $('#stepBack').addClass('disabled');
                $('#stepForward').addClass('disabled');
                $('#togglePlayback').addClass('disabled');
                $('#attrLegend').fadeOut("medium");
                $('#groupLegend').fadeOut("medium");
                break;
            default:
                const selection = split[val];

                // Do not allow a splittable attribute to be grouped by if it has a filter applied to it!
                if (filters.has(selection)) {
                    $('#groupingTab').addClass('was-validated');
                    $(this).val('');
                    group = null;
                    $('#attrLegend').fadeOut("medium");
                    $('#groupLegend').fadeOut("medium");
                    preCalculate();
                    return;
                }

                group = selection;
                preCalculate();
                $('#stepBack').removeClass('disabled');
                $('#stepForward').removeClass('disabled');
                $('#togglePlayback').removeClass('disabled');
                break;
        }
    });

    /* Append supported split values to dropdown lists. */
    for (const attr in split) {
        $('#selectFilterAttr').append(new Option(convertSplit(attr), attr));

        // Don't allow DCA code in group splitting. Too many values. Too dangerous.
        if (attr !== split.DCA_CODE)
            $('#selectGroupAttr').append(new Option(convertSplit(attr), attr));
    }

    $('#stepBack').on('click', function () {
        if ($(this).hasClass('disabled')) return;
        colorCycleGroup--;
        if (colorCycleGroup < 0) colorCycleGroup = possibleValues.get(group).length - 1;
        paused = true;
        updatePlaybackButton();
        recolor();
    });

    $('#stepForward').on('click', function () {
        if ($(this).hasClass('disabled')) return;
        colorCycleGroup++;
        if (colorCycleGroup >= possibleValues.get(group).length) colorCycleGroup = 0;
        paused = true;
        updatePlaybackButton();
        recolor();
    });

    $('#togglePlayback').on('click', function () {
        if ($(this).hasClass('disabled')) return;
        paused = !paused;
        updatePlaybackButton();
    });
}

function listActiveFilters() {
    // Remove old information.
    const div = $('#activeFilters');
    removeActiveFilterListeners();
    div.empty();

    if (filters.size === 0) return;
    div.append("<hr/><span>Active filters:</span>");

    let id = 0;
    for (const filter of filters.keys()) {
        id++;
        const amtExcluded = filters.get(filter).length;
        div.append(
            '<div class="container mb-3 filterInfo"><span>' + convertSplit(filter) + ' <em>(' + amtExcluded + ')</em></span>' +
            '<input type="button" id="rmv' + id + '" class="btn btn-danger btn-sm activeFilter" value="&times;" name="' + filter + '"/>' +
            '<input type="button" id="mod' + id + '" class="btn btn-warning btn-sm modFilter" value="Edit" name="' + filter + '"/>' +
            '</div>'
        );
        $('#rmv' + id).on('click', function () {
            // Delete and update active filters + visualisation.
            filters.delete($(this).attr('name'));
            listActiveFilters();
            keepPosition = true;
            preCalculate();
        });
        $('#mod' + id).on('click', function () {
            let name = $(this).attr('name');

            // Bring up filter value selection for this existing filter.
            createFilterSelection(name, true);
            $('#selectFilterAttr').val(name);
            $('#filterTab').removeClass('was-validated');

            // Meanwhile, delete existing filter and update.
            filters.delete(name);
            listActiveFilters();
            keepPosition = true;
            preCalculate();
        });
    }
}

function createFilterSelection(attr, editing) {
    // Clear old selection.
    const div = $('#filterValueSelection');
    removeFilterListeners();
    div.empty();

    // Check that they aren't adding a filter to an attribute that already has a filter.
    if (!editing)
        if (filters.has(attr)) {
            $('#selectFilterAttr').val('');
            $('#filterInvalid').text('There is already a filter active for this attribute!');
            $('#filterTab').addClass('was-validated');
            return;
        }

    // Don't allow a filter to be applied on an attribute that is being grouped.
    if (group === attr) {
        $('#selectFilterAttr').val('');
        $('#filterInvalid').text('You cannot apply a filter to an attribute that is being grouped!');
        $('#filterTab').addClass('was-validated');
        return;
    }

    let id = 0;
    for (const possible of possibleValues.get(attr)) {
        id++;

        // Leave an excluded value excluded if the user is editing their filter.
        let checked = 'checked';
        if (editing)
            checked = filters.get(attr).includes(possible) ? '' : 'checked';

        div.append(
            '<div class="form-check form-check-inline">' +
            '<input class="form-check-input filterCheckbox" type="checkbox" id="filter' + id + '" value="' + possible + '" ' + checked + '>' +
            '<label class="form-check-label" for="filter' + id + '">' + possible + '</label>' +
            '</div>'
        );
        $('#filter' + id).on('click', function () {
            // Disable apply button if no values have been excluded.
            $('#applyFilter').attr('disabled', describeFilterSelection() === 'all');

            // Re-check the checkbox. There must be at least one value selected.
            if (describeFilterSelection() === 'none') $(this).prop('checked', true);
        });
    }
    div.append('<hr/><button type="button" id="applyFilter" class="btn btn-primary btn-sm" ' + (editing ? '' : 'disabled') + '>Apply</button>');
    $('#applyFilter').on('click', function () {
        if (!applyFilter()) return;

        // Reset selection after applying filter.
        $('#selectFilterAttr').val('');
        removeFilterListeners();
        div.empty();

        listActiveFilters();
        keepPosition = true;
        preCalculate();
    });
}