#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
#    Copyright (C) 2011-2013 Ramine Tinati
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License, version 3,
#    as published by the Free Software Foundation.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.

import argparse, logging, getpass, sys, urllib2, json, sys
from indxclient import IndxClient
from tweepy.streaming import StreamListener
from tweepy import OAuthHandler
from tweepy import Stream


try:
    if args['debug']:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
except:
    pass

class TwitterService:

    def __init__(self, credentials, configs):
        print "loading Service Instance"
        self.appid = "twitter_service"
        self.indx_con = IndxClient(credentials['address'], credentials['box'], credentials['username'], credentials['password'], self.appid)
        self.consumer_key= configs['consumer_key']
        self.consumer_secret= configs['consumer_secret']
        self.access_token = configs['access_token']
        self.access_token_secret = configs['access_token_secret']
        self.version = 0
        self.batch = []
        print "got here"

    #this needs to call the database to get the search criteria...    
    def get_search_criteria(self):
        return ["happy", "sad"]


    def get_tweets(self, words_to_track):
        l = INDXListener()
        auth = OAuthHandler(self.consumer_key, self.consumer_secret)
        auth.set_access_token(self.access_token, self.access_token_secret)
        stream = Stream(auth, l)
        if len(words_to_track) > 0:
            print 'getting tweets...'
            stream.filter(track=words_to_track)
        else:
            stream.sample()

class INDXListener(StreamListener):
    """ A listener handles tweets are the received from the stream.
    This is a basic listener that just prints received tweets to stdout.

    """
    def on_data(self, tweet_data):
        """ Assert the tweet into INDX.
        If the version is incorrect, the correct version will be grabbed and the update re-sent.
        
        tweet -- The tweet to assert into the box.
        """
        global version
        global batch
        try:
            tweet = json.loads(tweet_data)
            logging.debug("{0}, {1}".format(type(tweet), tweet))
            if not tweet.get('text'):
                # TODO: log these for provenance?                
                logging.info("Skipping informational message: '{0}'".format(tweet_data.encode("utf-8")))
                return
            logging.info("Adding tweet: '{0}'".format(tweet['text'].encode("utf-8")))            
            tweet["@id"] = unicode(tweet['id'])
            tweet["app_object"] = service.appid
            text = unicode(tweet['text'])
            print text
            service.batch.append(tweet)
            if len(service.batch) > 25:
                response = service.indx_con.update(service.version, service.batch)
                service.version = response['data']['@version'] # update the version
                service.batch = []
        except Exception as e:
            if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
                if e.code == 409: # 409 Obsolete
                    response = e.read()
                    json_response = json.loads(response)
                    service.version = json_response['@version']
                    self.on_data(tweet_data) # try updating again now the version is correct
                else:
                    print '-------ERROR: ',e.read()
            else:
                print "didnt insert tweet"
                logging.error("Error updating INDX: {0}".format(e))
                sys.exit(0)                    
        return True

    def on_error(self, status):
        print "Status Error ",status

if __name__ == '__main__':

    #load and managed parameters
    def load_parameters():
        try:
            print "loading Credentials"
            credentials = {"address": sys.argv[1], "box": sys.argv[2], "username": sys.argv[3], "password": sys.argv[4]} 
            configs = {"consumer_key": sys.argv[5], "consumer_secret": sys.argv[6], "access_token": sys.argv[7], "access_token_secret": sys.argv[8]}
            return (credentials, configs)
        except:
            logging.error("COULD NOT START TWITTER APP - NO/INCORRECT CREDENTIALS")
            return False

    credentials, configs = load_parameters()
    if len(credentials)==4 and len(configs)==4:
        try:
            print "Giving Params"
            service = TwitterService(credentials, configs)
            words_to_search = service.get_search_criteria()
            service.get_tweets(words_to_search)
        except:
            print "FAILING HERE "+str(sys.exc_info())
