/* Chart creation values. */
const margin = {top: 20, right: 50, bottom: 30, left: 50};
let width;
let height;

function baseChart() {
    // Calculate SVG dimensions.
    width = (w * .6) - margin.left - margin.right;
    height = (h * .75) - margin.top - margin.bottom;

    // Create SVG canvas.
    return svg = d3.select('#modalChartBody').append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
}

function ungroupedHistogram() {
    let data = [];

    // Populate data array.
    for (const LGA of LGA_names)
        if (vis_mode === vis_modes.TOTAL)
            data.push(stats.get(LGA)[selected_scale].total);
        else data.push(stats.get(LGA)[selected_scale].average);

    let body = $('#modalChartBody');
    body.empty();

    let range = vis_mode === vis_modes.TOTAL ? stats.get('range').get(selected_scale) : stats.get('rangeavg').get(selected_scale);
    let svg = baseChart();

    // Calculate X scale.
    const x = d3.scaleLinear().domain([range.lowest, range.highest]).range([0, width]);

    // Calculate histogram bins.
    const thresholds = d3.range(range.lowest, range.highest, (range.highest - range.lowest) / $('#selectBinSize').val());
    const hist = d3.histogram().domain(x.domain()).thresholds(thresholds)(data);

    // Calculate Y scale.
    let y = d3.scaleLinear().domain([0, d3.max(hist, function (d) {
        return d.length;
    })]).range([height, 0]);

    // Draw axis.
    svg.append("g").attr("transform", "translate(0," + height + ")").call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y));

    // Append bars to SVG canvas.
    svg.selectAll("rect")
        .data(hist)
        .enter()
        .append("rect")
        .attr("x", 1)
        .attr("transform", function (d) {
            return "translate(" + x(d.x0) + "," + y(d.length) + ")";
        })
        .attr("width", function (d) {
            return x(d.x1) - x(d.x0) - 1;
        })
        .attr("height", function (d) {
            return height - y(d.length);
        })
        .style("fill", gcol(Math.random() * 10, 10));

    // Generate chart legend.
    body.append('<div class="legend"></div>');
    let legend = $('.legend');
    legend.append('<span>N = ' + selected + '</span><br/>');
    if (vis_mode === vis_modes.TOTAL)
        legend.append('<span>Min = ' + range.lowest + ', Max = ' + range.highest + '</span><br/>');
    else legend.append('<span>Min = ' + range.lowest.toFixed(3) + ', Max = ' + range.highest.toFixed(3) + '</span><br/>');

    const isProp = vis_mode === vis_modes.AVERAGE && isProportion(selected_scale);
    const name = convertScale(selected_scale);
    const scaleWord = vis_mode === vis_modes.TOTAL ? 'Total ' : isProp ? 'Proportion of ' : 'Average ';
    const newName = isProp ? name.replace('# of ', '') : name;
    body.append('<div class="xAxis">' + scaleWord + newName + '</div>');

    $('#modalChart').modal('show');
}

function groupedHistogram() {
    if (group === split.DCA_CODE)
        alert("Attempting to display histogram with data grouped by DCA Codes. This may take a while.");

    let data = new Map();
    const vals = possibleValues.get(group);

    // Get the largest and smallest value for every single group.
    let min, max;

    // Populate map with possible values.
    for (const possible of vals) {
        data.set(possible, []);

        // Search for lowest value in every possible group.
        if (vis_mode === vis_modes.TOTAL)
            range = stats.get('rangegroup').get(possible).get(selected_scale);
        else range = stats.get('rangegroupavg').get(possible).get(selected_scale);
        if (range !== undefined) {
            if (min === undefined || range.lowest < min) min = range.lowest;
            if (max === undefined || range.highest > max) max = range.highest;
        }

        // Populate data arrays.
        for (const LGA of LGA_names) {
            if (vis_mode === vis_modes.TOTAL)
                data.get(possible).push(stats.get(LGA)[selected_scale].groups.get(possible).total);
            else
                data.get(possible).push(stats.get(LGA)[selected_scale].groups.get(possible).average);
        }
    }

    let body = $('#modalChartBody');
    body.empty();

    let svg = baseChart();

    // Calculate overall X scale.
    const x = d3.scaleLinear().domain([min, max]).range([0, width]);

    // Calculate x-axis bin thresholds.
    const thresholds = d3.range(min, max, (max - min) / $('#selectBinSize').val());

    const groupBins = [];

    // Calculate histogram bins for each group.
    for (const possible of vals) {
        let bins = d3.histogram().domain(x.domain()).thresholds(thresholds)(data.get(possible));
        let i = 0;
        for (const bin of bins) {
            bin.grp = possible;
            bin.index = i;
            i++;
        }
        groupBins.push(bins);
    }

    // Total lengths of each bin when all groups are combined.
    const lengths = [];
    // Concatenate histogram bins into one array.
    const allData = [];
    for (const groupBin of groupBins)
        for (const bin of groupBin) {
            allData.push(bin);
            if (isNaN(lengths[bin.index])) lengths[bin.index] = bin.length;
            else lengths[bin.index] += bin.length;
        }

    // Calculate Y scale.
    let y = d3.scaleLinear().domain([0, d3.max(lengths)]).range([height, 0]);

    // Draw axis.
    svg.append("g").attr("transform", "translate(0," + height + ")").call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y));

    // Append bars to SVG canvas.
    svg.selectAll("rect")
        .data(allData)
        .enter()
        .append("rect")
        .attr("x", 1)
        .attr("transform", function (d, i) {
            const prev = previousHeights(y, d, i, allData);
            return "translate(" + x(d.x0) + "," + (y(d.length) - prev) + ")";
        })
        .attr("width", function (d) {
            return x(d.x1) - x(d.x0) - 1;
        })
        .attr("height", function (d) {
            return height - y(d.length);
        })
        .attr("fill", function (d) {
            return gcol(vals.indexOf(d.grp) + 1, vals.length);
        })
        .attr('value', function (d) {
            return d.grp
        });

    // Generate chart legend.
    body.append('<div class="legend"></div>');
    let legend = $('.legend');
    legend.append('<span>N = ' + selected + '</span><br/>');
    if (vis_mode === vis_modes.TOTAL)
        legend.append('<span>Min = ' + min + ', Max = ' + max + '</span><br/>');
    else legend.append('<span>Min = ' + min.toFixed(3) + ', Max = ' + max.toFixed(3) + '</span><br/>');

    legend.append('<span>Grouped by ' + convertSplit(group) + '</span><br/>');
    for (const val of vals) {
        legend.append(
            '<svg width="16" height="16">' +
            '<rect x="4" y="4" height="8" width="8" fill="' + gcol(vals.indexOf(val) + 1, vals.length) + '" stroke="black" stroke-width="1px"></rect>' +
            '</svg>');
        legend.append('<span>' + val + "</span><br/>");
    }

    const isProp = vis_mode === vis_modes.AVERAGE && isProportion(selected_scale);
    const name = convertScale(selected_scale);
    const scaleWord = vis_mode === vis_modes.TOTAL ? 'Total ' : isProp ? 'Proportion of ' : 'Average ';
    const newName = isProp ? name.replace('# of ', '') : name;
    body.append('<div class="xAxis">' + scaleWord + newName + '</div>');

    $('#modalChart').modal('show');
}

function previousHeights(y, d, i, allBins) {
    let total = 0;
    const vals = possibleValues.get(group);
    for (const bin of allBins) {
        if (vals.indexOf(bin.grp) >= vals.indexOf(d.grp)) continue;
        if (bin.index !== d.index) continue;
        if (bin.length === 0) continue;
        // Only calculate previous heights up until the selected possible value.
        total += height - y(bin.length);
    }
    if (total === 0) return 0;
    else return total;
}
