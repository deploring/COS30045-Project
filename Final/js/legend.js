/*
 * Code adapted from user 'syntagmatic' on bl.ocks.org.
 * Credit for original code has been given and supplied below:
 * http://bl.ocks.org/syntagmatic/e8ccca52559796be775553b467593a9f
 *
 * Note that I have modified this to work with my own application.
 */
function continuous(selector_id, colorscale) {

    $(selector_id).empty();

    // Append label to axis.
    $(selector_id).append('<span id="axisLabel"><em>' + convertScale(selected_scale) + '</em></span>');

    const legendheight = 80,
        legendwidth = 750 * (w / 1920),
        margin = {top: 2, right: 30, bottom: 60, left: 10};


    const canvas = d3.select(selector_id)
        .style("height", legendheight + "px")
        .style("width", legendwidth + "px")
        .style("position", "relative")
        .append("canvas")
        .attr("height", 1)
        .attr("width", legendwidth - margin.left - margin.right)
        .style("height", (legendheight - margin.top - margin.bottom) + "px")
        .style("width", (legendwidth - margin.left - margin.right) + "px")
        .style("border", "1px solid #000")
        .style("position", "absolute")
        .style("margin-left", margin.left + 'px')
        .style("top", (margin.top) + "px")
        .style("left", (margin.left) + "px")
        .node();

    const ctx = canvas.getContext("2d");

    const legendscale = d3.scaleLinear()
        .range([1, legendwidth - margin.left - margin.right])
        .domain(colorscale.domain());

    const image = ctx.createImageData(legendwidth, 1);
    d3.range(legendwidth).forEach(function (i) {
        const c = d3.rgb(colorscale(legendscale.invert(i)));
        image.data[4 * i] = c.r;
        image.data[4 * i + 1] = c.g;
        image.data[4 * i + 2] = c.b;
        image.data[4 * i + 3] = 255;
    });
    ctx.putImageData(image, 0, 0);

    const ticks = [legendscale.domain()[0], legendscale.domain()[1] - ((legendscale.domain()[1] - legendscale.domain()[0]) / 2), legendscale.domain()[1]];
    const legendaxis = d3.axisBottom()
        .scale(legendscale)
        .tickValues(ticks)
        .tickSize(6)
        .ticks(5);

    const svg = d3.select(selector_id)
        .append("svg")
        .attr("height", (legendheight) + "px")
        .attr("width", (legendwidth) + "px")
        .style("position", "absolute")
        .style("left", "0px")
        .style("top", "0px");

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + (legendheight - margin.top - margin.bottom + 1) + "," + (margin.left + 12) + ")")
        .call(legendaxis);
}