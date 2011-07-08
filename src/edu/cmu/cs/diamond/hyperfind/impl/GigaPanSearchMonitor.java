package edu.cmu.cs.diamond.hyperfind.impl;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Vector;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.sun.net.httpserver.*;

import edu.cmu.cs.diamond.hyperfind.HyperFindSearchMonitor;
import edu.cmu.cs.diamond.hyperfind.HyperFindResult;
import edu.cmu.cs.diamond.opendiamond.Result;
import edu.cmu.cs.diamond.opendiamond.Util;

public class GigaPanSearchMonitor extends HyperFindSearchMonitor {

    private boolean isRunning = false;
    private HttpServer myServer = null;
    private Vector<HyperFindResult> myResults;
    private Map<HyperFindResult, Integer> myResultsReverse;
    private ExecutorService myThreadPool;
    private Vector<HyperFindResult> myHighlightedResults;
    private int mySerialNumber = 0;
    private static final String[] myPushAttributes = { "gigapan_height",
            "gigapan_width", "gigapan_levels", "gigapan_id", "tile_level",
            "tile_col", "tile_row" };

    private GigaPanSearchMonitor() {
        myResults = new Vector<HyperFindResult>();
        myResultsReverse = new HashMap<HyperFindResult, Integer>();
        myHighlightedResults = new Vector<HyperFindResult>();
    }

    @Override
    public final void notify(HyperFindResult hr) {
        synchronized (myResults) {
            if (!isRunning && hr.getResult().getValue("gigapan_id") != null) {
                isRunning = true;
                myThreadPool = Executors.newCachedThreadPool();
                createWebComponent();
            }
            myResultsReverse.put(hr, myResults.size());
            myResults.add(hr);
            myResults.notifyAll();
        }
    }

    private final void createWebComponent() {
        try {
            // create server
            myServer = HttpServer.create(new InetSocketAddress(0), 0);
            myServer.createContext("/", new IndexHandler());
            // long-polling handler for data callbacks
            myServer.createContext("/data", new DataHandler());
            // handler for popups
            myServer.createContext("/display", new DisplayHandler());
            myServer.setExecutor(myThreadPool);

            // start server
            myServer.start();
            int port = myServer.getAddress().getPort();

            // launch browser
            Runtime r = Runtime.getRuntime();
            r.exec("xdg-open http://127.0.0.1:" + port);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public final void selectionChanged(List<HyperFindResult> selected) {
        synchronized (myResults) {
            myHighlightedResults.removeAllElements();
            myHighlightedResults.addAll(selected);
            mySerialNumber++;
            myResults.notifyAll();
        }

    }

    @Override
    public final void stopped() {
        /*
         * synchronized (myResults) { if (isRunning) { isRunning = false;
         * myResults.notifyAll(); System.out.println("Server stopped"); } }
         */
    }

    @Override
    public final void terminated() {
        synchronized (myResults) {
            if (myServer != null) {
                isRunning = false;
                myResults.notifyAll();
                new Thread() {
                    @Override
                    public void run() {
                        try {
                            Thread.sleep(5000);
                            myThreadPool.shutdownNow();
                            myServer.stop(0);
                        } catch (InterruptedException e) {
                            //
                        }
                    }
                }.start();
            }
        }
    }

    public static final GigaPanSearchMonitor createSearchMonitor() {
        return new GigaPanSearchMonitor();
    }

    /*
     * Return a JSON-encoded object representing the HyperFindResult parameter
     * that can be found in the specified list of results.
     */
    private final JSONObject createResultObject(HyperFindResult hr) {
        Result r = hr.getResult();
        try {
            JSONObject resultJSON = new JSONObject();
            resultJSON.put("level",
                    Util.extractString(r.getValue("tile_level")));
            resultJSON.put("row", Util.extractString(r.getValue("tile_row")));
            resultJSON.put("col", Util.extractString(r.getValue("tile_col")));
            resultJSON.put("result_id", myResults.indexOf(hr));
            resultJSON.put("gigapan_id",
                    Util.extractString(r.getValue("gigapan_id")));
            resultJSON.put("gigapan_height",
                    Util.extractString(r.getValue("gigapan_height")));
            resultJSON.put("gigapan_width",
                    Util.extractString(r.getValue("gigapan_width")));
            resultJSON.put("gigapan_levels",
                    Util.extractString(r.getValue("gigapan_levels")));
            return resultJSON;
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    /*
     * Return a JSON-encoded array of objects representing the HyperFindResult
     * objects found in the specified list.
     */
    private final JSONArray createResultObjectList(List<HyperFindResult> v) {
        Vector<JSONObject> jv = new Vector<JSONObject>();
        for (HyperFindResult hr : v) {
            jv.add(createResultObject(hr));
        }
        return new JSONArray(jv);
    }

    private static final void addTerminationInstruction(JSONArray result) {
        try {
            System.out.println("Added terminate instruction...");
            JSONObject terminateObj = new JSONObject();
            terminateObj.put("terminate", true);
            result.put(result.length(), terminateObj);
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    private static final void sendResponse(HttpExchange exchange,
            JSONArray response) throws IOException {
        System.out.println("Sending " + response.length() + " objects...");
        byte[] b = response.toString().getBytes();
        exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED, b.length);
        exchange.getResponseBody().write(b);
        exchange.close();
    }

    @Override
    public Set<String> getPushAttributes() {
        return new HashSet<String>(Arrays.asList(myPushAttributes));
    }

    final class DataHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            System.out.println("Received result callback request...");
            JSONArray results;
            String[] request = exchange.getRequestURI().getQuery().split("&");
            Map<String, String> query = new HashMap<String, String>();
            for (String s : request) {
                String[] st = s.split("=");
                query.put(st[0], st[1]);
            }
            int desiredResult = Integer.parseInt(query.get("desiredResult"));
            int serialNumber = Integer.parseInt(query.get("serialNumber"));
            synchronized (myResults) {
                while (myResults.size() <= desiredResult && isRunning
                        && serialNumber == mySerialNumber) {
                    try {
                        myResults.wait();
                    } catch (InterruptedException e) {
                        break;
                    }
                }
                results = createResultObjectList(myResults.subList(
                        desiredResult, myResults.size()));

                if (serialNumber != mySerialNumber) {
                    try {
                        JSONObject highlights = new JSONObject();
                        highlights.put("highlight",
                                createResultObjectList(myHighlightedResults));
                        highlights.put("serial", mySerialNumber);
                        results.put(results.length(), highlights);
                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                }
            }

            if (!isRunning) {
                addTerminationInstruction(results);
            }

            sendResponse(exchange, results);
        }
    }

    final class DisplayHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            byte[] b = Util.readFully(exchange.getRequestBody());
            int request = Integer
                    .parseInt(new String(b, "UTF-8").split("=")[1]);
            System.out.println("Received request to display " + request);
            myResults.get(request).popup();
            exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED, 0);
            exchange.close();
        }

    }

    final class IndexHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String req = exchange.getRequestURI().toString();
            if (req.equals("/")) {
                InputStream is = getClass().getClassLoader()
                        .getResourceAsStream("resources/multi.html");
                byte[] b = Util.readFully(is);
                exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                        b.length);
                exchange.getResponseBody().write(b);
                exchange.close();
            } else if (req.contains("resource")) {
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
