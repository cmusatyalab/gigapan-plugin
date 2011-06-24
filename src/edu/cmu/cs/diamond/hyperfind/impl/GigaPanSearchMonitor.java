package edu.cmu.cs.diamond.hyperfind.impl;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Vector;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.sun.net.httpserver.*;

import edu.cmu.cs.diamond.hyperfind.HyperFindSearchMonitor;
import edu.cmu.cs.diamond.opendiamond.Filter;
import edu.cmu.cs.diamond.opendiamond.Result;
import edu.cmu.cs.diamond.opendiamond.Util;

public class GigaPanSearchMonitor extends HyperFindSearchMonitor {

    private List<Filter> myFilters;
    private boolean myStatus = false;
    private HttpServer myServer;
    private JSONObject myGigaPan;
    private Vector<JSONObject> myResults;
    private static final String[] myPushAttributes = { "gigapan_height",
            "gigapan_width", "gigapan_levels", "gigapan_id", "tile_level",
            "tile_col", "tile_row" };

    private GigaPanSearchMonitor(List<Filter> filters) {
        myFilters = filters;
        myStatus = true;
        myResults = new Vector<JSONObject>();
    }

    @Override
    public final void notify(Result r) {
        synchronized (myResults) {
            if (myGigaPan == null) {
                myGigaPan = createGigaPanInfo(r);
                createWebComponent();
            }
            myResults.add(createResultObject(r));
            myResults.notifyAll();
        }

    }

    private final void createWebComponent() {
        try {
            // create server
            myServer = HttpServer.create(new InetSocketAddress(0), 0);
            myServer.createContext("/", new IndexHandler());
            myServer.createContext("/gigapanID", new GigaPanInfoHandler());
            myServer.createContext("/results", new CallbackHandler());
            myServer.setExecutor(null);

            // start server
            myServer.start();
            int port = myServer.getAddress().getPort();
            System.out.println("Server is listening on port: " + port);

            // launch browser
            Runtime r = Runtime.getRuntime();
            r.exec("xdg-open http://127.0.0.1:" + port);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public final void stopped() {
        synchronized (myResults) {
            myStatus = false;
            myGigaPan = null;
            myServer.stop(0);
            myResults.notifyAll();
            System.out.println("Server stopped");
        }
    }

    public static final HyperFindSearchMonitor createSearchMonitor(
            List<Filter> filters) {
        return new GigaPanSearchMonitor(filters);
    }

    private static final JSONObject createGigaPanInfo(Result r) {
        try {
            JSONObject gigaPan = new JSONObject();
            gigaPan.put("id", Util.extractString(r.getValue("gigapan_id")));
            gigaPan.put("height",
                    Util.extractString(r.getValue("gigapan_height")));
            gigaPan.put("width",
                    Util.extractString(r.getValue("gigapan_width")));
            gigaPan.put("levels",
                    Util.extractString(r.getValue("gigapan_levels")));
            return gigaPan;
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static final JSONObject createResultObject(Result r) {
        try {
            JSONObject resultJSON = new JSONObject();
            resultJSON.put("level",
                    Util.extractString(r.getValue("tile_level")));
            resultJSON.put("row", Util.extractString(r.getValue("tile_row")));
            resultJSON.put("col", Util.extractString(r.getValue("tile_col")));
            return resultJSON;
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    @Override
    public Set<String> getPushAttributes() {
        return new HashSet<String>(Arrays.asList(myPushAttributes));
    }

    final class CallbackHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            System.out.println("Request received!");
            JSONArray results;
            int desiredResult = Integer.parseInt(exchange.getRequestURI()
                    .getQuery().split("=")[1]);

            synchronized (myResults) {
                while (myResults.size() <= desiredResult && myStatus) {
                    try {
                        System.out.println("Waiting....");
                        myResults.wait();
                    } catch (InterruptedException e) {
                        break;
                    }
                }
                results = new JSONArray(myResults.subList(desiredResult,
                        myResults.size()));
            }

            System.out.println("Sent " + results.length() + "results");
            byte[] b = results.toString().getBytes();
            exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                    b.length);
            exchange.getResponseBody().write(b);
            exchange.close();
        }
    }

    final class GigaPanInfoHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            byte[] b = myGigaPan.toString().getBytes();
            exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                    b.length);
            exchange.getResponseBody().write(b);
            exchange.close();
        }
    }

    final class IndexHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String req = exchange.getRequestURI().toString();
            if (req.equals("/")) {
                InputStream is = getClass().getClassLoader()
                        .getResourceAsStream("resources/index.html");
                byte[] b = Util.readFully(is);
                exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                        b.length);
                exchange.getResponseBody().write(b);
                exchange.close();
            } else {
                InputStream is = getClass().getClassLoader()
                        .getResourceAsStream(req.substring(1));
                byte[] b = Util.readFully(is);
                exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                        b.length);
                exchange.getResponseBody().write(b);
                exchange.close();
            }
        }
    }
}